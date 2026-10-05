-- Eyedrones — avviso via email al pilota quando arriva una richiesta di preventivo dalla sua pagina pubblica
-- Richiede di aver già eseguito «pagina-pilota.sql».
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi. Alla fine mostra il codice segreto da copiare su Netlify (AVVISO_SEGRETO).
--
-- Come funziona: a ogni nuova richiesta il database chiama (in sottofondo, con pg_net) la funzione Netlify
-- «avviso-richiesta», che manda l'email con Resend. Se qualcosa non va, la richiesta viene salvata lo stesso.

-- 1) l'estensione di Supabase per fare chiamate web dal database
create extension if not exists pg_net;

-- 2) il pilota può spegnere l'avviso dalla pagina «La mia pagina»
alter table public.pagine_pilota add column if not exists avviso_email boolean not null default true;

-- 3) impostazioni riservate: non leggibili dall'app né dai visitatori
create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;
create table if not exists privato.impostazioni (chiave text primary key, valore text not null);
revoke all on privato.impostazioni from public, anon, authenticated;

insert into privato.impostazioni (chiave, valore) values
  ('avviso_url', 'https://app.eyedrones.it/.netlify/functions/avviso-richiesta'),
  ('avviso_segreto', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (chiave) do nothing;

-- 4) alla nuova richiesta: prepara i dati (email del pilota compresa) e chiama la funzione Netlify
create or replace function public.avvisa_nuova_richiesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_segreto text;
  v_email_pilota text;
  v_nome_pilota text;
  v_avviso boolean;
begin
  select g.avviso_email, coalesce(nullif(g.nome, ''), p.azienda_nome), coalesce(nullif(p.email, ''), u.email)
    into v_avviso, v_nome_pilota, v_email_pilota
  from public.pagine_pilota g
  left join public.profili p on p.user_id = g.user_id
  left join auth.users u on u.id = g.user_id
  where g.user_id = new.user_id;

  if not coalesce(v_avviso, false) or v_email_pilota is null then return new; end if;

  select valore into v_url from privato.impostazioni where chiave = 'avviso_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return new; end if;

  begin
    perform net.http_post(
      url := v_url,
      body := jsonb_build_object(
        'pilota_email', v_email_pilota,
        'pilota_nome', v_nome_pilota,
        'nome', new.nome,
        'email', new.email,
        'telefono', new.telefono,
        'servizio', new.servizio,
        'luogo', new.luogo,
        'data_desiderata', new.data_desiderata,
        'descrizione', new.descrizione
      ),
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
      timeout_milliseconds := 8000
    );
  exception when others then
    -- l'avviso non è partito (pg_net assente o URL sbagliato): la richiesta resta salvata e il pilota la vede nell'app
    raise warning 'avviso richiesta non inviato: %', sqlerrm;
  end;
  return new;
end;
$$;

revoke all on function public.avvisa_nuova_richiesta() from public, anon, authenticated;

drop trigger if exists richieste_preventivo_avviso on public.richieste_preventivo;
create trigger richieste_preventivo_avviso
  after insert on public.richieste_preventivo
  for each row execute function public.avvisa_nuova_richiesta();

-- 5) il codice segreto da copiare su Netlify come variabile AVVISO_SEGRETO
select valore as "copia questo in AVVISO_SEGRETO su Netlify" from privato.impostazioni where chiave = 'avviso_segreto';
