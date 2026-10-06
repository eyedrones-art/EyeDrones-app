-- EyeDrones — segnalazione errori, spazio usato e promemoria scadenze via email
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
-- Alla fine mostra il codice segreto da copiare su Netlify come AVVISO_SEGRETO (se l'hai già fatto per gli avvisi
-- delle richieste di preventivo, è lo stesso codice: non serve cambiarlo).

-- =========================================================================================================
-- 1) Errori dell'app: quando qualcosa si rompe l'app lo annota qui (pagina, messaggio). Li legge solo l'amministratore.
-- =========================================================================================================
create table if not exists public.errori_app (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid(),
  pagina text,
  messaggio text,
  dettagli text,
  indirizzo text,
  dispositivo text,
  created_at timestamptz not null default now()
);
create index if not exists errori_app_data on public.errori_app (created_at desc);

alter table public.errori_app enable row level security;

drop policy if exists "errori_app: chiunque segnala" on public.errori_app;
create policy "errori_app: chiunque segnala" on public.errori_app
  for insert to anon, authenticated
  with check (char_length(coalesce(messaggio, '')) <= 500 and char_length(coalesce(dettagli, '')) <= 3000 and char_length(coalesce(pagina, '')) <= 100);

drop policy if exists "errori_app: legge l'amministratore" on public.errori_app;
create policy "errori_app: legge l'amministratore" on public.errori_app
  for select using ((auth.jwt() ->> 'email') in ('eyedrones@libero.it', 'ravinale.ivan@libero.it'));

-- =========================================================================================================
-- 2) Spazio usato da foto, video e documenti di chi è collegato (per il limite durante il lancio)
-- =========================================================================================================
create or replace function public.spazio_usato()
returns bigint
language sql
stable
security definer
set search_path = storage, public
as $$
  select coalesce(sum((metadata ->> 'size')::bigint), 0)
  from storage.objects
  where owner_id = auth.uid()::text or owner = auth.uid();
$$;
revoke all on function public.spazio_usato() from public, anon;
grant execute on function public.spazio_usato() to authenticated;

-- =========================================================================================================
-- 3) Promemoria scadenze via email: ogni mattina alle 9 (ora italiana circa) il database prepara l'elenco
--    di attestati, assicurazioni, manutenzioni e abbonamento D-Flight che scadono tra 30 giorni, tra 7 o oggi,
--    e lo passa alla funzione Netlify «promemoria-scadenze-background», che manda le email con Resend.
--    All'amministratore arriva anche il riepilogo degli errori del giorno prima e dello spazio usato.
-- =========================================================================================================
create extension if not exists pg_net;
create extension if not exists pg_cron;

alter table public.profili add column if not exists promemoria_email boolean not null default true;

create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;
create table if not exists privato.impostazioni (chiave text primary key, valore text not null);
revoke all on privato.impostazioni from public, anon, authenticated;
insert into privato.impostazioni (chiave, valore) values
  ('promemoria_url', 'https://app.eyedrones.it/.netlify/functions/promemoria-scadenze-background'),
  ('avviso_segreto', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (chiave) do nothing;

create or replace function privato.invia_promemoria()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  oggi date := (now() at time zone 'Europe/Rome')::date;
  giorni int[] := array[30, 7, 0];
  v_voci jsonb := '[]'::jsonb;
  v_parte jsonb;
  v_utenti jsonb;
  v_url text;
  v_segreto text;
  v_errori jsonb;
  v_spazio bigint;
begin
  select valore into v_url from privato.impostazioni where chiave = 'promemoria_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;

  -- ogni parte è separata: se una tabella o una colonna non c'è, le altre partono lo stesso
  begin
    select coalesce(jsonb_agg(jsonb_build_object('user_id', a.user_id, 'titolo', a.tipo, 'data', a.data_scadenza, 'giorni', a.data_scadenza - oggi)), '[]')
      into v_parte from public.attestati a where (a.data_scadenza - oggi) = any (giorni);
    v_voci := v_voci || v_parte;
  exception when others then raise warning 'promemoria attestati: %', sqlerrm; end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object('user_id', d.user_id, 'titolo', 'Manutenzione — ' || d.nome, 'data', d.prossima_manutenzione, 'giorni', d.prossima_manutenzione - oggi)), '[]')
      into v_parte from public.droni d where (d.prossima_manutenzione - oggi) = any (giorni);
    v_voci := v_voci || v_parte;
  exception when others then raise warning 'promemoria droni: %', sqlerrm; end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object('user_id', p.user_id, 'titolo', 'Abbonamento D-Flight (QR code operatore)', 'data', p.dflight_scadenza, 'giorni', p.dflight_scadenza - oggi)), '[]')
      into v_parte from public.profili p where (p.dflight_scadenza - oggi) = any (giorni);
    v_voci := v_voci || v_parte;
  exception when others then raise warning 'promemoria D-Flight: %', sqlerrm; end;

  -- raggruppo per utente, solo chi non ha spento i promemoria
  select coalesce(jsonb_agg(jsonb_build_object('email', u.email, 'nome', p.azienda_nome, 'voci', x.voci)), '[]')
    into v_utenti
  from (
    select (v ->> 'user_id')::uuid as user_id, jsonb_agg(v - 'user_id' order by (v ->> 'giorni')::int) as voci
    from jsonb_array_elements(v_voci) v
    group by 1
  ) x
  join auth.users u on u.id = x.user_id
  left join public.profili p on p.user_id = x.user_id
  where coalesce(p.promemoria_email, true) and u.email is not null;

  -- riepilogo per l'amministratore: errori delle ultime 24 ore e spazio totale
  begin
    select jsonb_build_object('quanti', count(*), 'esempi', coalesce((select jsonb_agg(e) from (select pagina, messaggio, count(*) as volte from public.errori_app where created_at > now() - interval '24 hours' group by 1, 2 order by 3 desc limit 8) e), '[]'))
      into v_errori from public.errori_app where created_at > now() - interval '24 hours';
    delete from public.errori_app where created_at < now() - interval '60 days';
  exception when others then v_errori := null; end;
  begin
    select coalesce(sum((metadata ->> 'size')::bigint), 0) into v_spazio from storage.objects;
  exception when others then v_spazio := null; end;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('utenti', v_utenti, 'amministratore', jsonb_build_object('email', 'eyedrones@libero.it', 'errori', v_errori, 'spazio_byte', v_spazio)),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function privato.invia_promemoria() from public, anon, authenticated;

-- ogni giorno alle 7:00 UTC (9:00 d'estate, 8:00 d'inverno in Italia)
select cron.unschedule('eyedrones-promemoria') where exists (select 1 from cron.job where jobname = 'eyedrones-promemoria');
select cron.schedule('eyedrones-promemoria', '0 7 * * *', 'select privato.invia_promemoria()');

-- il codice segreto da copiare su Netlify come variabile AVVISO_SEGRETO
select valore as "copia questo in AVVISO_SEGRETO su Netlify" from privato.impostazioni where chiave = 'avviso_segreto';
