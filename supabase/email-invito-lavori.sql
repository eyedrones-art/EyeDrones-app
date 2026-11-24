-- EyeDrones — email «Ci sono lavori con drone che aspettano un pilota»
-- UNA SOLA VOLTA a chi ha le email accese e non ha ancora la pagina in «Trova un pilota», con l'elenco dei lavori
-- aperti adesso (solo servizio e provincia: niente dati del cliente). 40 al giorno, lun–ven alle 9:40 UTC,
-- dentro il tetto comune delle email una tantum. Quando l'hanno ricevuta tutti, o non ci sono più lavori aperti, il giro si ferma.
-- IMPORTANTE: eseguirlo solo DOPO che la nuova versione è online su Netlify.
-- Da eseguire una volta: SQL Editor → incolla tutto → Run.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists privato.email_invito_lavori (user_id uuid primary key, inviata timestamptz not null default now());
revoke all on privato.email_invito_lavori from public, anon, authenticated;

-- il tetto comune delle email una tantum conta anche questa
create or replace function privato.email_restanti_oggi()
returns int language plpgsql stable security definer set search_path = public as $f$
declare
  v_inizio timestamptz := date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  v_usate int := 0; v_n int; t text;
begin
  foreach t in array array['email_primi_passi', 'email_primo_volo', 'email_community', 'email_lavori', 'email_pagina', 'email_invito_lavori'] loop
    if to_regclass('privato.' || t) is not null then
      execute format('select count(*) from privato.%I where inviata >= $1', t) into v_n using v_inizio;
      v_usate := v_usate + coalesce(v_n, 0);
    end if;
  end loop;
  return greatest(0, 55 - v_usate);
end $f$;
revoke all on function privato.email_restanti_oggi() from public, anon, authenticated;

create or replace function privato.invia_invito_lavori()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_max int; v_url text; v_segreto text; v_utenti jsonb; v_lavori jsonb;
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if extract(isodow from v_oggi) > 5 then return; end if;
  select valore into v_url from privato.impostazioni where chiave = 'promemoria_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;

  -- i lavori aperti adesso: solo servizio e provincia
  select jsonb_agg(jsonb_build_object('servizio', servizio, 'provincia', provincia) order by created_at desc) into v_lavori
  from (
    select z.servizio, z.provincia, z.created_at from public.richieste_zona z
    where z.stato = 'aperta' and (to_jsonb(z) ->> 'pilota_diretto') is null
      and z.created_at > now() - interval '60 days'
      and (z.data_desiderata is null or z.data_desiderata >= current_date)
    order by z.created_at desc limit 5
  ) x;
  if v_lavori is null then
    perform cron.unschedule('eyedrones-invito-lavori');
    return;
  end if;

  v_max := least(40, privato.email_restanti_oggi());
  if v_max <= 0 then return; end if;

  with scelti as (
    select u.id, u.email, p.azienda_nome as nome
    from auth.users u
    left join public.profili p on p.user_id = u.id
    where u.email is not null
      and coalesce(p.promemoria_email, true)
      and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
      and u.created_at < now() - interval '1 day'
      and not exists (select 1 from public.pagine_pilota g where g.user_id = u.id and g.attiva)
      and not exists (select 1 from privato.email_invito_lavori e where e.user_id = u.id)
      -- chi ha ricevuto da poco un'altra email di EyeDrones la riceve un altro giorno
      and (to_regclass('privato.email_pagina') is null or not exists (select 1 from privato.email_pagina e where e.user_id = u.id and e.inviata > now() - interval '3 days'))
    order by u.created_at desc
    limit v_max
  ), segnati as (
    insert into privato.email_invito_lavori (user_id) select id from scelti on conflict do nothing returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', s.email, 'nome', s.nome)), '[]') into v_utenti
  from scelti s join segnati g on g.user_id = s.id;

  if jsonb_array_length(v_utenti) = 0 then
    perform cron.unschedule('eyedrones-invito-lavori');
    return;
  end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('invito_lavori', v_utenti, 'lavori_aperti', v_lavori),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto), timeout_milliseconds := 10000);
end $$;
revoke all on function privato.invia_invito_lavori() from public, anon, authenticated;

select cron.unschedule('eyedrones-invito-lavori') where exists (select 1 from cron.job where jobname = 'eyedrones-invito-lavori');
select cron.schedule('eyedrones-invito-lavori', '40 9 * * 1-5', 'select privato.invia_invito_lavori()');

-- quante persone la riceveranno (e i lavori che vedranno)
select count(*) as "riceveranno l'email «Ci sono lavori aperti»"
from auth.users u left join public.profili p on p.user_id = u.id
where u.email is not null and coalesce(p.promemoria_email, true)
  and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
  and not exists (select 1 from public.pagine_pilota g where g.user_id = u.id and g.attiva)
  and not exists (select 1 from privato.email_invito_lavori e where e.user_id = u.id);
