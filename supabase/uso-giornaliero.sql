-- EyeDrones — Uso dell'app: un segno per ogni giorno in cui un iscritto apre l'app.
-- Serve solo per sapere quanti la usano davvero (e quando). Niente di esterno: resta qui.

-- 1) Una volta sola: incolla fino alla riga «2)» nello SQL Editor e premi Run (si può rieseguire senza danni)
create table if not exists public.uso_giornaliero (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  giorno date not null default current_date,
  primary key (user_id, giorno)
);
alter table public.uso_giornaliero enable row level security;
drop policy if exists "uso: segno solo il mio" on public.uso_giornaliero;
create policy "uso: segno solo il mio" on public.uso_giornaliero
  for insert with check (user_id = auth.uid());
drop policy if exists "uso: leggo solo il mio" on public.uso_giornaliero;
create policy "uso: leggo solo il mio" on public.uso_giornaliero
  for select using (user_id = auth.uid());

-- 2) Ogni volta che vuoi vedere i numeri: incolla da qui in giù e premi Run
select
  (select count(distinct user_id) from public.uso_giornaliero where giorno > current_date - 7) as attivi_7_giorni,
  (select count(distinct user_id) from public.uso_giornaliero where giorno > current_date - 30) as attivi_30_giorni,
  (select count(distinct user_id) from public.uso_giornaliero where extract(isodow from giorno) in (6, 7) and giorno > current_date - 30) as nel_weekend_30_giorni,
  (select count(*) from (select user_id from public.uso_giornaliero group by user_id having count(*) >= 2) x) as tornati_almeno_una_volta;
