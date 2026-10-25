-- EyeDrones — email del giovedì «Il weekend giusto per volare»
-- Chi la attiva nell'app (Impostazioni o Home: comune o posizione) riceve ogni giovedì il momento migliore del
-- weekend vicino a casa e i posti consigliati dagli altri piloti entro 30 km. Se il weekend è brutto non parte.
-- Il meteo lo calcola la funzione Netlify dei promemoria (promemoria-scadenze-background), con Open-Meteo.
-- Serve aver già eseguito lo script errori-spazio-promemoria.sql (crea le impostazioni e il codice segreto).
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.

create extension if not exists pg_net;
create extension if not exists pg_cron;

-- la zona di chi la vuole: solo il comune e coordinate arrotondate (circa 1 km), mai la via
alter table public.profili add column if not exists avviso_weekend boolean not null default false;
alter table public.profili add column if not exists zona_nome text;
alter table public.profili add column if not exists zona_lat double precision;
alter table public.profili add column if not exists zona_lon double precision;

-- una sola volta a settimana per persona
create table if not exists privato.email_weekend (
  user_id uuid not null,
  settimana date not null,
  primary key (user_id, settimana)
);
revoke all on privato.email_weekend from public, anon, authenticated;

create or replace function privato.invia_weekend()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text;
  v_segreto text;
  v_utenti jsonb;
  v_settimana date := date_trunc('week', now())::date;
begin
  select valore into v_url from privato.impostazioni where chiave = 'promemoria_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;

  -- al massimo 60 a settimana: con Resend gratuito ci sono 100 email al giorno anche per i promemoria
  with scelti as (
    select u.id, u.email, p.azienda_nome as nome, p.zona_nome, p.zona_lat, p.zona_lon
    from auth.users u
    join public.profili p on p.user_id = u.id
    where u.email is not null
      and p.avviso_weekend
      and p.zona_lat is not null and p.zona_lon is not null
      and coalesce(p.promemoria_email, true)
      and not exists (select 1 from privato.email_weekend e where e.user_id = u.id and e.settimana = v_settimana)
    order by u.created_at
    limit 60
  ), segnati as (
    insert into privato.email_weekend (user_id, settimana) select id, v_settimana from scelti
    on conflict do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'email', s.email, 'nome', s.nome, 'zona', s.zona_nome, 'lat', s.zona_lat, 'lon', s.zona_lon,
    -- i due posti consigliati più vicini entro 30 km (quelli con il voto più alto a parità di distanza)
    'posti', (
      select coalesce(jsonb_agg(x order by (x->>'km')::numeric), '[]') from (
        select jsonb_build_object('nome', c.nome, 'tipo', c.tipo, 'nota', left(coalesce(c.nota, ''), 140), 'voto', c.voto, 'lat', c.lat, 'lon', c.lon,
          'km', round((111.2 * sqrt(power(c.lat - s.zona_lat, 2) + power((c.lon - s.zona_lon) * cos(radians(s.zona_lat)), 2)))::numeric, 1)) as x
        from public.posti_consigliati c
        where abs(c.lat - s.zona_lat) < 0.3 and abs(c.lon - s.zona_lon) < 0.42
          and 111.2 * sqrt(power(c.lat - s.zona_lat, 2) + power((c.lon - s.zona_lon) * cos(radians(s.zona_lat)), 2)) <= 30
        order by 111.2 * sqrt(power(c.lat - s.zona_lat, 2) + power((c.lon - s.zona_lon) * cos(radians(s.zona_lat)), 2)), c.voto desc nulls last
        limit 2
      ) q
    )
  )), '[]')
    into v_utenti
  from scelti s join segnati g on g.user_id = s.id;

  if jsonb_array_length(v_utenti) = 0 then return; end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('weekend', v_utenti),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 10000
  );
end;
$$;
revoke all on function privato.invia_weekend() from public, anon, authenticated;

-- ogni giovedì alle 16:40 UTC (17:40 d'inverno, 18:40 d'estate in Italia)
select cron.unschedule('eyedrones-weekend') where exists (select 1 from cron.job where jobname = 'eyedrones-weekend');
select cron.schedule('eyedrones-weekend', '40 16 * * 4', 'select privato.invia_weekend()');

-- quante persone l'hanno attivata
select count(*) as "hanno attivato «il weekend giusto»"
from public.profili p
where p.avviso_weekend and p.zona_lat is not null;
