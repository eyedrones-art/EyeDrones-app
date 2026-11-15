-- EyeDrones — da dove arrivano i piloti e cosa fanno nell'app.
-- Solo NUMERI: nessuna email, nessun nome. Da eseguire quando vuoi: SQL Editor → incolla tutto → Run.
-- Il risultato è una tabella con tre colonne: sezione, voce, persone. Si può scaricare in CSV (pulsante in basso).
with
iscritti as (
  select u.id, u.created_at, p.referral, p.moduli
  from auth.users u left join public.profili p on p.user_id = u.id
  where u.email not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
),
giorni as (select user_id, count(*) as n, max(giorno) as ultimo from public.uso_giornaliero group by user_id)

select '1 · Da dove arrivano' as sezione, coalesce(nullif(referral, ''), 'diretto / non si sa') as voce, count(*) as persone
from iscritti group by 2

union all
select '2 · Iscritti per mese', to_char(date_trunc('month', created_at), 'YYYY-MM'), count(*)
from iscritti where created_at > now() - interval '8 months' group by 2

union all
select '3 · Quanto la usano', v, n from (values
  ('totale iscritti', (select count(*) from iscritti)),
  ('aperta negli ultimi 7 giorni', (select count(*) from giorni g join iscritti i on i.id = g.user_id where g.ultimo > current_date - 7)),
  ('aperta negli ultimi 30 giorni', (select count(*) from giorni g join iscritti i on i.id = g.user_id where g.ultimo > current_date - 30)),
  ('aperta in 5 giorni diversi o più', (select count(*) from giorni g join iscritti i on i.id = g.user_id where g.n >= 5)),
  ('aperta un giorno solo (iscritti e spariti)', (select count(*) from iscritti i where coalesce((select n from giorni g where g.user_id = i.id), 0) <= 1))
) t(v, n)

union all
select '4 · Cosa hanno fatto almeno una volta', v, n from (values
  ('aggiunto un drone', (select count(distinct user_id) from public.droni where user_id in (select id from iscritti))),
  ('caricato un attestato', (select count(distinct user_id) from public.attestati where user_id in (select id from iscritti))),
  ('registrato un volo', (select count(distinct user_id) from public.voli where user_id in (select id from iscritti))),
  ('pianificato un volo', (select count(distinct user_id) from public.piani_volo where user_id in (select id from iscritti))),
  ('aggiunto un permesso', (select count(distinct user_id) from public.permessi where user_id in (select id from iscritti))),
  ('fatto un preventivo', (select count(distinct user_id) from public.preventivi where user_id in (select id from iscritti))),
  ('fatto un''ispezione', (select count(distinct user_id) from public.ispezioni where user_id in (select id from iscritti))),
  ('pagina pilota creata', (select count(*) from public.pagine_pilota where user_id in (select id from iscritti))),
  ('pagina pilota attiva in Trova un pilota', (select count(*) from public.pagine_pilota where attiva and user_id in (select id from iscritti))),
  ('notifiche accese sul telefono', (select count(distinct utente) from public.notifiche_push where utente in (select id from iscritti)))
) t(v, n)

union all
select '5 · Come usano l''app (scelta in Impostazioni)', m, count(*)
from iscritti i, jsonb_array_elements_text(case when jsonb_typeof(to_jsonb(i.moduli)) = 'array' then to_jsonb(i.moduli) else '[]'::jsonb end) m
group by 2

union all
select '6 · Pagine pilota per provincia', coalesce(nullif(provincia, ''), '?'), count(*)
from public.pagine_pilota where user_id in (select id from iscritti) group by 2

union all
select '7 · Servizi offerti nelle pagine', s, count(*)
from public.pagine_pilota g, unnest(g.servizi) s where g.user_id in (select id from iscritti) group by 2

order by 1, 3 desc;
