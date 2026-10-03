-- Registro interventi di manutenzione dei droni (pagina "I miei droni" e fascicolo del volo)
create table if not exists public.manutenzioni_droni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  drone_id text not null,
  data date not null default current_date,
  tipo text not null,
  descrizione text,
  documento_url text,
  created_at timestamptz not null default now()
);

create index if not exists manutenzioni_droni_drone on public.manutenzioni_droni (drone_id, data desc);

alter table public.manutenzioni_droni enable row level security;

drop policy if exists "manutenzioni_droni: solo le proprie" on public.manutenzioni_droni;
create policy "manutenzioni_droni: solo le proprie" on public.manutenzioni_droni
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
