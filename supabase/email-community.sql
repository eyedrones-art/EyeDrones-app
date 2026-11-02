-- EyeDrones — email «Hai un posto del cuore dove volare? Consiglialo ⭐» (community dei posti)
-- Va UNA SOLA VOLTA a ogni iscritto con le email di EyeDrones accese, 40 al giorno (Resend gratuito: 100 al giorno in tutto).
-- Parte ogni mattina alle 8:30 UTC finché non l'hanno ricevuta tutti, poi il giro si cancella da solo.
-- La manda la funzione Netlify dei promemoria (promemoria-scadenze-background). Serve errori-spazio-promemoria.sql già eseguito.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists privato.email_community (
  user_id uuid primary key,
  inviata timestamptz not null default now()
);
revoke all on privato.email_community from public, anon, authenticated;

create or replace function privato.invia_community()
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

  with scelti as (
    select u.id, u.email, p.azienda_nome as nome
    from auth.users u
    left join public.profili p on p.user_id = u.id
    where u.email is not null
      and coalesce(p.promemoria_email, true)
      and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
      -- chi ha ricevuto oggi i «primi passi» la riceve un altro giorno
      and not exists (select 1 from privato.email_primi_passi e where e.user_id = u.id and e.inviata > now() - interval '20 hours')
      and not exists (select 1 from privato.email_community c where c.user_id = u.id)
    order by u.created_at
    limit 40
  ), segnati as (
    insert into privato.email_community (user_id) select id from scelti
    on conflict do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('email', s.email, 'nome', s.nome)), '[]')
    into v_utenti
  from scelti s join segnati g on g.user_id = s.id;

  -- finito: l'hanno ricevuta tutti, tolgo il giro
  if jsonb_array_length(v_utenti) = 0 then
    perform cron.unschedule('eyedrones-community');
    return;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('community', v_utenti),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function privato.invia_community() from public, anon, authenticated;

select cron.unschedule('eyedrones-community') where exists (select 1 from cron.job where jobname = 'eyedrones-community');
select cron.schedule('eyedrones-community', '30 8 * * *', 'select privato.invia_community()');

-- quante persone la riceveranno (40 al giorno)
select count(*) as "riceveranno l'email «consiglia un posto»"
from auth.users u
left join public.profili p on p.user_id = u.id
where u.email is not null
  and coalesce(p.promemoria_email, true)
  and u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
  and not exists (select 1 from privato.email_community c where c.user_id = u.id);
