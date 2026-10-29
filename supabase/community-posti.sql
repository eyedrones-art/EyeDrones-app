-- EyeDrones — community dei posti: «👍 Utile» sui posti consigliati dagli altri piloti
-- Chi consiglia un posto vede in Home quanti piloti l'hanno trovato utile (e nell'email del giovedì).
-- Nessuno vede chi ha messo il grazie né chi ha consigliato il posto.
-- Serve aver già eseguito posti-consigliati.sql. Da eseguire una volta: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi.

create table if not exists public.posti_grazie (
  posto_id uuid not null references public.posti_consigliati(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (posto_id, user_id)
);
create index if not exists posti_grazie_data on public.posti_grazie (created_at);

alter table public.posti_grazie enable row level security;

-- ognuno vede solo i suoi grazie (per sapere se l'ha già messo); i totali arrivano da grazie_posti()
drop policy if exists "grazie: vedo i miei" on public.posti_grazie;
create policy "grazie: vedo i miei" on public.posti_grazie
  for select to authenticated using (user_id = auth.uid());

-- il grazie si mette solo ai posti degli altri
drop policy if exists "grazie: metto i miei" on public.posti_grazie;
create policy "grazie: metto i miei" on public.posti_grazie
  for insert to authenticated with check (
    user_id = auth.uid()
    and exists (select 1 from public.posti_consigliati c where c.id = posto_id and c.user_id <> auth.uid())
  );

drop policy if exists "grazie: tolgo i miei" on public.posti_grazie;
create policy "grazie: tolgo i miei" on public.posti_grazie
  for delete to authenticated using (user_id = auth.uid());

-- quanti grazie hanno i posti mostrati in pagina (al massimo 300 alla volta)
create or replace function public.grazie_posti(p_ids uuid[])
returns table (posto_id uuid, quanti int)
language sql
stable
security definer
set search_path = public
as $$
  select g.posto_id, count(*)::int
  from public.posti_grazie g
  where auth.uid() is not null
    and g.posto_id = any (p_ids[1:300])
  group by g.posto_id;
$$;
revoke all on function public.grazie_posti(uuid[]) from public, anon;
grant execute on function public.grazie_posti(uuid[]) to authenticated;

-- il riquadro in Home: i miei posti, i grazie ricevuti e quanto è grande la community
create or replace function public.la_mia_community()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'posti', (select count(*) from public.posti_consigliati where user_id = auth.uid()),
    'grazie', (select count(*) from public.posti_grazie g join public.posti_consigliati c on c.id = g.posto_id where c.user_id = auth.uid()),
    'migliore', (
      select c.nome from public.posti_consigliati c
      join public.posti_grazie g on g.posto_id = c.id
      where c.user_id = auth.uid()
      group by c.id, c.nome order by count(*) desc limit 1
    ),
    'posti_tutti', (select count(*) from public.posti_consigliati),
    'piloti_tutti', (select count(distinct user_id) from public.posti_consigliati)
  ) end;
$$;
revoke all on function public.la_mia_community() from public, anon;
grant execute on function public.la_mia_community() to authenticated;
