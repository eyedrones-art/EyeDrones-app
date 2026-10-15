-- EyeDrones — email automatica «In regola in 3 minuti»
-- Ogni mattina il database cerca chi si è iscritto da almeno 2 giorni e non ha ancora messo il drone, e gli manda
-- UNA SOLA VOLTA un'email con il link alla guida dei primi passi (https://app.eyedrones.it/?vai=primi).
-- La manda la stessa funzione Netlify dei promemoria (promemoria-scadenze-background), con Resend.
-- Serve aver già eseguito lo script errori-spazio-promemoria.sql (crea le impostazioni e il codice segreto).
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- chi l'ha già ricevuta (così non arriva mai due volte)
create table if not exists privato.email_primi_passi (
  user_id uuid primary key,
  inviata timestamptz not null default now()
);
revoke all on privato.email_primi_passi from public, anon, authenticated;

create or replace function privato.invia_primi_passi()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_segreto text;
  v_utenti jsonb;
begin
  select valore into v_url from privato.impostazioni where chiave = 'promemoria_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;

  -- al massimo 40 al giorno: con Resend gratuito ci sono 100 email al giorno anche per i promemoria
  with scelti as (
    select u.id, u.email, p.azienda_nome as nome
    from auth.users u
    left join public.profili p on p.user_id = u.id
    where u.email is not null
      and u.created_at < now() - interval '2 days'
      and coalesce(p.promemoria_email, true)
      and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
      and not exists (select 1 from public.droni d where d.user_id = u.id)
      and not exists (select 1 from privato.email_primi_passi e where e.user_id = u.id)
    order by u.created_at
    limit 40
  ), segnati as (
    insert into privato.email_primi_passi (user_id) select id from scelti
    on conflict do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', s.email, 'nome', s.nome)), '[]')
    into v_utenti
  from scelti s join segnati g on g.user_id = s.id;

  if jsonb_array_length(v_utenti) = 0 then return; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('primi_passi', v_utenti),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function privato.invia_primi_passi() from public, anon, authenticated;

-- ogni giorno alle 8:00 UTC (10:00 d'estate, 9:00 d'inverno in Italia), dopo i promemoria delle scadenze
select cron.unschedule('eyedrones-primi-passi') where exists (select 1 from cron.job where jobname = 'eyedrones-primi-passi');
select cron.schedule('eyedrones-primi-passi', '0 8 * * *', 'select privato.invia_primi_passi()');

-- quante persone la riceveranno nei prossimi giorni (40 al giorno)
select count(*) as "riceveranno l'email «primi passi»"
from auth.users u
left join public.profili p on p.user_id = u.id
where u.email is not null
  and u.created_at < now() - interval '2 days'
  and coalesce(p.promemoria_email, true)
  and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
  and not exists (select 1 from public.droni d where d.user_id = u.id)
  and not exists (select 1 from privato.email_primi_passi e where e.user_id = u.id);
