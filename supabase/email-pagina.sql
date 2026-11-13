-- EyeDrones — email «I clienti cercano un pilota: crea la tua pagina in 3 minuti»
-- UNA SOLA VOLTA a chi ha le email accese e non ha ancora la pagina in «Trova un pilota». 40 al giorno, lun–ven alle 9:15 UTC.
-- Quando l'hanno ricevuta tutti, il giro si cancella da solo. La manda la funzione Netlify dei promemoria.
-- IMPORTANTE: eseguirlo solo DOPO che la nuova versione è online su Netlify (altrimenti l'email risulta mandata ma non parte).
-- Da eseguire una volta: SQL Editor → incolla tutto → Run.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists privato.email_pagina (user_id uuid primary key, inviata timestamptz not null default now());
revoke all on privato.email_pagina from public, anon, authenticated;
create table if not exists privato.email_primi_passi (user_id uuid primary key, inviata timestamptz not null default now());
create table if not exists privato.email_community (user_id uuid primary key, inviata timestamptz not null default now());
create table if not exists privato.email_lavori (user_id uuid primary key, inviata timestamptz not null default now());

-- il tetto comune delle email una tantum conta anche questa
create or replace function privato.email_restanti_oggi()
returns int language plpgsql stable security definer set search_path = public as $f$
declare
  v_inizio timestamptz := date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  v_usate int := 0; v_n int; t text;
begin
  foreach t in array array['email_primi_passi', 'email_primo_volo', 'email_community', 'email_lavori', 'email_pagina'] loop
    if to_regclass('privato.' || t) is not null then
      execute format('select count(*) from privato.%I where inviata >= $1', t) into v_n using v_inizio;
      v_usate := v_usate + coalesce(v_n, 0);
    end if;
  end loop;
  return greatest(0, 55 - v_usate);
end $f$;
revoke all on function privato.email_restanti_oggi() from public, anon, authenticated;

create or replace function privato.invia_email_pagina()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_max int; v_url text; v_segreto text; v_utenti jsonb;
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if extract(isodow from v_oggi) > 5 then return; end if;
  select valore into v_url from privato.impostazioni where chiave = 'promemoria_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;
  v_max := least(40, privato.email_restanti_oggi());
  if v_max <= 0 then return; end if;

  with scelti as (
    select u.id, u.email, p.azienda_nome as nome
    from auth.users u
    left join public.profili p on p.user_id = u.id
    where u.email is not null
      and coalesce(p.promemoria_email, true)
      and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
      and u.created_at < now() - interval '1 day'                       -- non il giorno stesso dell'iscrizione
      and not exists (select 1 from public.pagine_pilota g where g.user_id = u.id and g.attiva and g.in_elenco)
      and not exists (select 1 from privato.email_pagina e where e.user_id = u.id)
      -- chi ha ricevuto da poco un'altra email di EyeDrones la riceve un altro giorno
      and not exists (select 1 from privato.email_primi_passi e where e.user_id = u.id and e.inviata > now() - interval '3 days')
      and not exists (select 1 from privato.email_community c where c.user_id = u.id and c.inviata > now() - interval '3 days')
      and not exists (select 1 from privato.email_lavori l where l.user_id = u.id and l.inviata > now() - interval '3 days')
    order by u.created_at
    limit v_max
  ), segnati as (
    insert into privato.email_pagina (user_id) select id from scelti on conflict do nothing returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', s.email, 'nome', s.nome)), '[]') into v_utenti
  from scelti s join segnati g on g.user_id = s.id;

  if jsonb_array_length(v_utenti) = 0 then
    perform cron.unschedule('eyedrones-email-pagina');
    return;
  end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('pagina', v_utenti),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto), timeout_milliseconds := 10000);
end $$;
revoke all on function privato.invia_email_pagina() from public, anon, authenticated;

select cron.unschedule('eyedrones-email-pagina') where exists (select 1 from cron.job where jobname = 'eyedrones-email-pagina');
select cron.schedule('eyedrones-email-pagina', '15 9 * * 1-5', 'select privato.invia_email_pagina()');

-- quante persone la riceveranno
select count(*) as "riceveranno l'email «Crea la tua pagina»"
from auth.users u left join public.profili p on p.user_id = u.id
where u.email is not null and coalesce(p.promemoria_email, true)
  and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
  and not exists (select 1 from public.pagine_pilota g where g.user_id = u.id and g.attiva and g.in_elenco)
  and not exists (select 1 from privato.email_pagina e where e.user_id = u.id);
