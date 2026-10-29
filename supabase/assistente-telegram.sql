-- EyeDrones — l'assistente del mattino su Telegram: ogni mattina alle 7:30 (ora italiana d'inverno, 8:30 d'estate)
-- il database prepara i numeri del giorno prima e li manda alla funzione Netlify «assistente-telegram», che li scrive
-- all'amministratore su Telegram. Solo conteggi: nessun nome, email o telefono di utenti o clienti.
-- Prima serve errori-spazio-promemoria.sql (crea privato.impostazioni e il codice segreto).
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.

insert into privato.impostazioni (chiave, valore) values
  ('telegram_url', 'https://app.eyedrones.it/.netlify/functions/assistente-telegram')
on conflict (chiave) do nothing;

create or replace function privato.numeri_mattino()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  v := jsonb_build_object(
    'iscritti', (select count(*) from auth.users),
    'nuovi', (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'nuovi_7', (select count(*) from auth.users where created_at > now() - interval '7 days'));
  -- ogni parte è separata: se una tabella non c'è ancora, le altre arrivano lo stesso
  begin
    if to_regclass('public.uso_giornaliero') is not null then
      v := v || jsonb_build_object(
        'attivi_ieri', (select count(distinct user_id) from public.uso_giornaliero where giorno = (now() at time zone 'Europe/Rome')::date - 1),
        'attivi_7', (select count(distinct user_id) from public.uso_giornaliero where giorno > (now() at time zone 'Europe/Rome')::date - 7));
    end if;
  exception when others then null; end;
  begin
    v := v || jsonb_build_object('voli', (select count(*) from public.voli where created_at > now() - interval '24 hours'));
  exception when others then null; end;
  begin
    if to_regclass('public.richieste_zona') is not null then
      v := v || jsonb_build_object(
        'richieste', (select count(*) from public.richieste_zona where created_at > now() - interval '24 hours'),
        'richieste_dove', (select coalesce(jsonb_agg(jsonb_build_object('provincia', upper(provincia), 'servizio', servizio)), '[]')
                           from (select provincia, servizio from public.richieste_zona where created_at > now() - interval '24 hours' order by created_at limit 10) r),
        'offerte', (select count(*) from public.offerte_zona where created_at > now() - interval '24 hours'),
        'scelte', (select count(*) from public.richieste_zona where scelta_il > now() - interval '24 hours'),
        'confermati', (select count(*) from public.offerte_zona where confermata_il > now() - interval '24 hours'),
        'senza_offerte', (select count(*) from public.richieste_zona z where z.stato = 'aperta' and z.created_at < now() - interval '24 hours'
                            and z.created_at > now() - interval '14 days' and not exists (select 1 from public.offerte_zona o where o.richiesta_id = z.id)));
    end if;
  exception when others then null; end;
  begin
    if to_regclass('public.richieste_preventivo') is not null then
      v := v || jsonb_build_object('richieste_pagine', (select count(*) from public.richieste_preventivo where created_at > now() - interval '24 hours'));
    end if;
  exception when others then null; end;
  begin
    if to_regclass('public.pagine_pilota') is not null then
      v := v || jsonb_build_object('pagine_nuove', (select count(*) from public.pagine_pilota where attiva and created_at > now() - interval '24 hours'));
    end if;
  exception when others then null; end;
  begin
    if to_regclass('public.errori_app') is not null then
      v := v || jsonb_build_object('errori', (select count(*) from public.errori_app where created_at > now() - interval '24 hours'));
    end if;
  exception when others then null; end;
  return v;
end;
$$;
revoke all on function privato.numeri_mattino() from public, anon, authenticated;

create or replace function privato.invia_mattino()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_segreto text;
begin
  select valore into v_url from privato.impostazioni where chiave = 'telegram_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('tipo', 'mattino', 'numeri', privato.numeri_mattino()),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 10000);
end;
$$;
revoke all on function privato.invia_mattino() from public, anon, authenticated;

-- ogni giorno alle 6:30 UTC (7:30 d'inverno, 8:30 d'estate in Italia)
select cron.unschedule('eyedrones-telegram-mattino') where exists (select 1 from cron.job where jobname = 'eyedrones-telegram-mattino');
select cron.schedule('eyedrones-telegram-mattino', '30 6 * * *', 'select privato.invia_mattino()');

-- per provarlo subito, dopo aver messo le variabili su Netlify: select privato.invia_mattino();
