-- EYEDRONES — notifiche sul telefono per i voli pianificati, i pagamenti e le consegne.
--   sera (circa 18-19):   «Domani voli a …» con il meteo all'ora del volo · «Domani hai il lavoro per …» (Trova un pilota)
--   mattina (circa 7-8):  «Oggi alle … voli a …» con il meteo · pagamenti dei preventivi che scadono oggi o in ritardo
--                         · lavori di Trova un pilota fatti ma non ancora consegnati
-- Solo a chi ha attivato le notifiche su almeno un telefono (notifiche-push.sql). Ogni avviso parte una volta sola.
-- Il meteo lo calcola la funzione Netlify promemoria-push. Serve aver già eseguito errori-spazio-promemoria.sql,
-- notifiche-push.sql, pagamenti-collaboratori.sql e trova-pilota.sql.
-- Da eseguire una volta: SQL Editor → incolla tutto → Run. Si può rieseguire.

create extension if not exists pg_net;
create extension if not exists pg_cron;

create table if not exists privato.push_promemoria (
  chiave text primary key,
  creato timestamptz not null default now()
);
revoke all on privato.push_promemoria from public, anon, authenticated;

create or replace function privato.invia_push_promemoria(p_momento text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_url text; v_segreto text; v_avvisi jsonb;
  v_oggi date := (now() at time zone 'Europe/Rome')::date;
begin
  select replace(valore, 'promemoria-scadenze-background', 'promemoria-push') into v_url from privato.impostazioni where chiave = 'promemoria_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;
  delete from privato.push_promemoria where creato < now() - interval '60 days';

  with telefoni as (
    select utente, jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)) as t
    from public.notifiche_push group by utente
  ), candidati as (
    -- voli pianificati: domani (sera) o oggi (mattina), non ancora segnati come fatti
    select 'volo-' || p_momento || '-' || v.id || '-' || v.data_prevista as chiave, v.user_id as utente,
      jsonb_build_object('tipo', case when p_momento = 'sera' then 'volo_domani' else 'volo_oggi' end,
        'nome', left(v.impianto_nome, 80), 'data', v.data_prevista, 'ora', to_char(v.ora_prevista, 'HH24:MI'),
        'coordinate', coalesce(v.checklist_stato->'zona'->>'punto', v.luogo_coordinate),
        'zona', (select left(i.zona, 120) from public.impianti i where i.id = v.impianto_id)) as dati
    from public.piani_volo v
    where v.data_prevista = case when p_momento = 'sera' then v_oggi + 1 else v_oggi end
      and coalesce((v.checklist_stato->>'fatto')::boolean, false) = false
    union all
    -- lavori di «Trova un pilota» confermati per domani (sera)
    select 'lavoro-' || o.id || '-' || r.data_desiderata, o.user_id,
      jsonb_build_object('tipo', 'lavoro_domani', 'nome', left(r.nome, 60), 'servizio', left(r.servizio, 60), 'luogo', left(r.luogo, 80),
        'data', r.data_desiderata, 'coordinate', case when r.lat_esatta is not null then r.lat_esatta || ', ' || r.lon_esatta when r.lat is not null then r.lat || ', ' || r.lon end)
    from public.offerte_zona o join public.richieste_zona r on r.id = o.richiesta_id
    where p_momento = 'sera' and o.stato = 'confermata' and r.data_desiderata = v_oggi + 1
    union all
    -- pagamenti dei preventivi accettati: il giorno della scadenza, poi dopo 3 e dopo 10 giorni
    select 'pagamento-' || p.id || '-' || p.scadenza_pagamento || '-' || (v_oggi - p.scadenza_pagamento), p.user_id,
      jsonb_build_object('tipo', 'pagamento', 'nome', left(p.cliente, 60), 'prezzo', p.prezzo, 'ritardo', v_oggi - p.scadenza_pagamento)
    from public.preventivi p
    where p_momento = 'mattina' and p.stato = 'accettato' and not p.pagato
      and p.scadenza_pagamento is not null and (v_oggi - p.scadenza_pagamento) in (0, 3, 10)
    union all
    -- lavori fatti (la data è passata da 2 o da 5 giorni) ma non ancora consegnati al cliente
    select 'consegna-' || o.id || '-' || (v_oggi - r.data_desiderata), o.user_id,
      jsonb_build_object('tipo', 'consegna', 'nome', left(r.nome, 60), 'servizio', left(r.servizio, 60), 'data', r.data_desiderata)
    from public.offerte_zona o join public.richieste_zona r on r.id = o.richiesta_id
    where p_momento = 'mattina' and o.stato = 'confermata' and o.consegnata_il is null
      and (v_oggi - r.data_desiderata) in (2, 5)
  ), scelti as (
    select c.* from candidati c
    where exists (select 1 from telefoni t where t.utente = c.utente)
      and not exists (select 1 from privato.push_promemoria x where x.chiave = c.chiave)
    limit 300
  ), segnati as (
    insert into privato.push_promemoria (chiave) select chiave from scelti on conflict do nothing returning chiave
  )
  select coalesce(jsonb_agg(s.dati || jsonb_build_object('telefoni', t.t)), '[]') into v_avvisi
  from scelti s join segnati g on g.chiave = s.chiave join telefoni t on t.utente = s.utente;

  if jsonb_array_length(v_avvisi) = 0 then return; end if;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('avvisi', v_avvisi),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 10000
  );
end $$;
revoke all on function privato.invia_push_promemoria(text) from public, anon, authenticated;

-- sera alle 17:05 UTC (18:05 d'inverno, 19:05 d'estate) · mattina alle 5:35 UTC (6:35 d'inverno, 7:35 d'estate)
select cron.unschedule('eyedrones-push-sera') where exists (select 1 from cron.job where jobname = 'eyedrones-push-sera');
select cron.unschedule('eyedrones-push-mattina') where exists (select 1 from cron.job where jobname = 'eyedrones-push-mattina');
select cron.schedule('eyedrones-push-sera', '5 17 * * *', $c$select privato.invia_push_promemoria('sera')$c$);
select cron.schedule('eyedrones-push-mattina', '35 5 * * *', $c$select privato.invia_push_promemoria('mattina')$c$);

-- controllo: se una colonna manca, qui compare l'errore (e si capisce quale script eseguire prima)
select 'Notifiche di voli, pagamenti e consegne attive' as fatto,
  (select count(*) from (select v.user_id, v.impianto_id, v.luogo_coordinate, v.checklist_stato, v.ora_prevista, v.data_prevista from public.piani_volo v limit 1) a) as prova_voli,
  (select count(*) from (select p.user_id, p.cliente, p.prezzo, p.pagato, p.scadenza_pagamento from public.preventivi p limit 1) b) as prova_pagamenti,
  (select count(*) from public.notifiche_push) as telefoni_con_notifiche;
