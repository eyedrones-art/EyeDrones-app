-- Basta l'attestato più alto: se l'A2 o l'STS vale più a lungo, l'A1/A3 che scade non manda più il promemoria via email.
-- Aggiorna privato.invia_promemoria() di errori-spazio-promemoria.sql (stessa funzione, cambia solo la parte degli attestati). Si può rilanciare.

-- 1 = A1/A3, 2 = A2 o STS (teorico), 0 = altro
create or replace function privato.livello_attestato(p_tipo text)
returns int language sql immutable as $$
  select case
    when p_tipo ~* '\msts\M' and p_tipo !~* 'pratic' then 2
    when p_tipo ~* '\ma2\M' then 2
    when p_tipo ~* 'a1\s*/?\s*a3|\ma1\M|\ma3\M' then 1
    else 0 end;
$$;
revoke all on function privato.livello_attestato(text) from public, anon, authenticated;

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
      into v_parte from public.attestati a where (a.data_scadenza - oggi) = any (giorni)
        -- l'A1/A3 non si ricorda se c'è un A2 o un STS che vale più a lungo: conta l'attestato più alto
        and not (privato.livello_attestato(a.tipo) = 1 and exists (
          select 1 from public.attestati b where b.user_id = a.user_id and privato.livello_attestato(b.tipo) > 1 and b.data_scadenza > a.data_scadenza));
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
