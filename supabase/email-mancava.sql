-- EyeDrones — email «Una domanda veloce: cosa ti mancava?»
-- UNA SOLA VOLTA a chi si è iscritto da almeno 7 giorni, ha le email accese e non ha mai usato davvero l'app
-- (aperta al massimo un giorno e nessun drone). 30 al giorno, lun–ven alle 9:45 (ora italiana circa).
-- Nell'email ci sono dei tasti: la risposta si salva con un codice, senza dover entrare nell'app.
-- Quando l'hanno ricevuta tutti, il giro si cancella da solo. La manda la funzione Netlify dei promemoria.
-- IMPORTANTE: eseguirlo solo DOPO che la nuova versione è online su Netlify.
-- Da eseguire una volta: SQL Editor → incolla tutto → Run.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists privato.email_mancava (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inviata timestamptz not null default now(),
  codice uuid not null unique default gen_random_uuid(),
  risposta text,
  nota text,
  risposta_il timestamptz
);
revoke all on privato.email_mancava from public, anon, authenticated;

-- il tetto comune delle email una tantum conta anche questa
create or replace function privato.email_restanti_oggi()
returns int language plpgsql stable security definer set search_path = public as $f$
declare
  v_inizio timestamptz := date_trunc('day', now() at time zone 'Europe/Rome') at time zone 'Europe/Rome';
  v_usate int := 0; v_n int; t text;
begin
  foreach t in array array['email_primi_passi', 'email_primo_volo', 'email_community', 'email_lavori', 'email_pagina', 'email_mancava'] loop
    if to_regclass('privato.' || t) is not null then
      execute format('select count(*) from privato.%I where inviata >= $1', t) into v_n using v_inizio;
      v_usate := v_usate + coalesce(v_n, 0);
    end if;
  end loop;
  return greatest(0, 55 - v_usate);
end $f$;
revoke all on function privato.email_restanti_oggi() from public, anon, authenticated;

create or replace function privato.invia_email_mancava()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_max int; v_url text; v_segreto text; v_utenti jsonb;
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  if extract(isodow from v_oggi) > 5 then return; end if;
  select valore into v_url from privato.impostazioni where chiave = 'promemoria_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;
  v_max := least(30, privato.email_restanti_oggi());
  if v_max <= 0 then return; end if;

  with scelti as (
    select u.id, u.email, p.azienda_nome as nome
    from auth.users u
    left join public.profili p on p.user_id = u.id
    where u.email is not null
      and coalesce(p.promemoria_email, true)
      and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
      and u.created_at < now() - interval '7 days'
      and (select count(*) from public.uso_giornaliero g where g.user_id = u.id) <= 1   -- aperta al massimo un giorno
      and not exists (select 1 from public.droni d where d.user_id = u.id)              -- e nessun drone
      and not exists (select 1 from privato.email_mancava e where e.user_id = u.id)
      -- chi ha ricevuto da poco un'altra email di EyeDrones la riceve un altro giorno
      and not exists (select 1 from privato.email_primi_passi e where e.user_id = u.id and e.inviata > now() - interval '3 days')
      and not exists (select 1 from privato.email_community c where c.user_id = u.id and c.inviata > now() - interval '3 days')
      and not exists (select 1 from privato.email_lavori l where l.user_id = u.id and l.inviata > now() - interval '3 days')
      and not exists (select 1 from privato.email_pagina g where g.user_id = u.id and g.inviata > now() - interval '3 days')
    order by u.created_at
    limit v_max
  ), segnati as (
    insert into privato.email_mancava (user_id) select id from scelti on conflict do nothing returning user_id, codice
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', s.email, 'nome', s.nome, 'codice', g.codice)), '[]') into v_utenti
  from scelti s join segnati g on g.user_id = s.id;

  if jsonb_array_length(v_utenti) = 0 then
    perform cron.unschedule('eyedrones-email-mancava');
    return;
  end if;
  perform net.http_post(url := v_url, body := jsonb_build_object('mancava', v_utenti),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto), timeout_milliseconds := 10000);
end $$;
revoke all on function privato.invia_email_mancava() from public, anon, authenticated;

-- la risposta dai tasti dell'email (pagina app.eyedrones.it/cosa-ti-mancava.html): basta il codice dell'email
create or replace function public.mancava_rispondi(p_codice uuid, p_risposta text, p_nota text default null)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_risposta not in ('non_capito', 'niente_drone', 'funzione', 'complicata', 'altra_app', 'lavori', 'altro') then return false; end if;
  update privato.email_mancava
     set risposta = p_risposta,
         nota = coalesce(nullif(left(btrim(coalesce(p_nota, '')), 1000), ''), nota),
         risposta_il = now()
   where codice = p_codice;
  return found;
end $$;
revoke all on function public.mancava_rispondi(uuid, text, text) from public;
grant execute on function public.mancava_rispondi(uuid, text, text) to anon, authenticated;

select cron.unschedule('eyedrones-email-mancava') where exists (select 1 from cron.job where jobname = 'eyedrones-email-mancava');
select cron.schedule('eyedrones-email-mancava', '45 8 * * 1-5', 'select privato.invia_email_mancava()');

-- quante persone la riceveranno
select count(*) as "riceveranno l'email «Cosa ti mancava?»"
from auth.users u left join public.profili p on p.user_id = u.id
where u.email is not null and coalesce(p.promemoria_email, true)
  and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
  and u.created_at < now() - interval '7 days'
  and (select count(*) from public.uso_giornaliero g where g.user_id = u.id) <= 1
  and not exists (select 1 from public.droni d where d.user_id = u.id)
  and not exists (select 1 from privato.email_mancava e where e.user_id = u.id);

-- PER VEDERE LE RISPOSTE (quando vuoi, da solo):
-- select coalesce(risposta, 'non ha risposto') as risposta, count(*) from privato.email_mancava group by 1 order by 2 desc;
-- select risposta, nota, risposta_il from privato.email_mancava where nota is not null order by risposta_il desc;
