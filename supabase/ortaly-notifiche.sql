-- ORTALY — notifiche sul telefono dei produttori. Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run.
-- Si può rieseguire. Ogni telefono su cui il produttore attiva le notifiche è una riga qui.
create table if not exists public.notifiche (
  id uuid primary key default gen_random_uuid(),
  bottega uuid not null references public.botteghe(id) on delete cascade,
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  creata timestamptz not null default now()
);
create index if not exists notifiche_bottega on public.notifiche(bottega);

alter table public.notifiche enable row level security;
drop policy if exists "notifiche mie" on public.notifiche;
create policy "notifiche mie" on public.notifiche for all to authenticated
  using (bottega in (select id from public.botteghe where utente = auth.uid()))
  with check (bottega in (select id from public.botteghe where utente = auth.uid()));
revoke all on public.notifiche from anon;
grant select, insert, delete on public.notifiche to authenticated;
