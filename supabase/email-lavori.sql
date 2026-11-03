-- EyeDrones — email «La nuova EyeDrones è online»: le novità e l'invito ad attivare «La mia pagina» (Trova un pilota)
-- Va UNA SOLA VOLTA a ogni iscritto con le email di EyeDrones accese, 40 al giorno.
-- Chi ha già la pagina in «Trova un pilota» la riceve senza l'invito ad attivarla.
-- Parte dal 2 novembre 2026, solo dal lunedì al venerdì alle 8:45 UTC (chi lavora legge in settimana),
-- finché non l'hanno ricevuta tutti, poi il giro si cancella da solo.
-- La manda la funzione Netlify dei promemoria (promemoria-scadenze-background). Serve errori-spazio-promemoria.sql
-- già eseguito, e trova-pilota.sql (la funzione dev'essere online).
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists privato.email_lavori (
  user_id uuid primary key,
  inviata timestamptz not null default now()
);
revoke all on privato.email_lavori from public, anon, authenticated;
-- le altre email una tantum (se i loro script non sono ancora stati eseguiti, le tabelle restano vuote)
create table if not exists privato.email_primi_passi (user_id uuid primary key, inviata timestamptz not null default now());
create table if not exists privato.email_community (user_id uuid primary key, inviata timestamptz not null default now());
revoke all on privato.email_primi_passi from public, anon, authenticated;
revoke all on privato.email_community from public, anon, authenticated;

-- chi lavora con il drone
create or replace function privato.lavora_con_drone(p_uid uuid, p_moduli text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce(p_moduli, '') ~ '(ispezioni|agricoltura|rilievi)'
    or exists (select 1 from public.pagine_pilota x where x.user_id = p_uid)
    or exists (select 1 from public.preventivi x where x.user_id = p_uid)
    or exists (select 1 from public.clienti x where x.user_id = p_uid)
    or exists (select 1 from public.richieste_preventivo x where x.user_id = p_uid)
    or exists (select 1 from public.ispezioni x where x.user_id = p_uid)
    or exists (select 1 from public.impianti x where x.user_id = p_uid);
$$;
revoke all on function privato.lavora_con_drone(uuid, text) from public, anon, authenticated;

-- tetto comune delle email «una tantum» del giorno (Resend gratis: 100 email al giorno in tutto).
-- Le email una tantum (primi passi, primo volo, community, novità) insieme non superano 55 al giorno,
-- così restano almeno 45 email per le richieste dei clienti, le offerte e i promemoria delle scadenze.
create or replace function privato.email_restanti_oggi()
returns int
language plpgsql stable security definer set search_path = public
as $f$
declare
  v_inizio timestamptz := date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  v_usate int := 0;
  v_n int;
  t text;
begin
  foreach t in array array['email_primi_passi', 'email_primo_volo', 'email_community', 'email_lavori'] loop
    if to_regclass('privato.' || t) is not null then
      execute format('select count(*) from privato.%I where inviata >= $1', t) into v_n using v_inizio;
      v_usate := v_usate + coalesce(v_n, 0);
    end if;
  end loop;
  return greatest(0, 55 - v_usate);
end;
$f$;
revoke all on function privato.email_restanti_oggi() from public, anon, authenticated;

create or replace function privato.invia_email_lavori()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_max int;
  v_url text;
  v_segreto text;
  v_utenti jsonb;
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  -- solo dal 2 novembre (quando «Trova un pilota» è online) e solo nei giorni feriali
  if v_oggi < date '2026-11-02' or extract(isodow from v_oggi) > 5 then return; end if;
  -- e solo se «Trova un pilota» è già attivo (trova-pilota.sql eseguito)
  if to_regprocedure('public.lavori_in_zona()') is null then return; end if;
  select valore into v_url from privato.impostazioni where chiave = 'promemoria_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;
  -- tetto comune del giorno: se oggi sono già partite tante email, si riprende domani (senza togliere il giro)
  v_max := least(40, privato.email_restanti_oggi());
  if v_max <= 0 then return; end if;

  with scelti as (
    select u.id, u.email, p.azienda_nome as nome,
      exists (select 1 from public.pagine_pilota g where g.user_id = u.id and g.attiva and g.in_elenco) as pagina
    from auth.users u
    left join public.profili p on p.user_id = u.id
    where u.email is not null
      and coalesce(p.promemoria_email, true)
      and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
      -- chi ha ricevuto oggi un'altra email di EyeDrones la riceve un altro giorno
      and not exists (select 1 from privato.email_primi_passi e where e.user_id = u.id and e.inviata > now() - interval '20 hours')
      and not exists (select 1 from privato.email_community c where c.user_id = u.id and c.inviata > now() - interval '20 hours')
      and not exists (select 1 from privato.email_lavori l where l.user_id = u.id)
    order by u.created_at
    limit v_max
  ), segnati as (
    insert into privato.email_lavori (user_id) select id from scelti
    on conflict do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', s.email, 'nome', s.nome, 'pagina', s.pagina)), '[]')
    into v_utenti
  from scelti s join segnati g on g.user_id = s.id;

  -- finito: l'hanno ricevuta tutti, tolgo il giro
  if jsonb_array_length(v_utenti) = 0 then
    perform cron.unschedule('eyedrones-email-lavori');
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('lavori', v_utenti),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function privato.invia_email_lavori() from public, anon, authenticated;

select cron.unschedule('eyedrones-email-lavori') where exists (select 1 from cron.job where jobname = 'eyedrones-email-lavori');
select cron.schedule('eyedrones-email-lavori', '45 8 * * 1-5', 'select privato.invia_email_lavori()');

-- quante persone la riceveranno (40 al giorno, dal lunedì al venerdì)
select count(*) as "riceveranno l'email «La nuova EyeDrones»"
from auth.users u
left join public.profili p on p.user_id = u.id
where u.email is not null
  and coalesce(p.promemoria_email, true)
  and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
  and not exists (select 1 from privato.email_lavori l where l.user_id = u.id);
