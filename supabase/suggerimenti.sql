-- Suggerimenti e segnalazioni inviati dagli utenti dalla pagina "Suggerimenti" dell'app.
-- Si leggono da Supabase → Table Editor → suggerimenti.
create table if not exists public.suggerimenti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  email text,
  tipo text not null default 'suggerimento',
  testo text not null,
  pagina text,
  dispositivo text,
  screenshot_url text,
  letto boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.suggerimenti enable row level security;

drop policy if exists "suggerimenti: inserisci i propri" on public.suggerimenti;
create policy "suggerimenti: inserisci i propri" on public.suggerimenti
  for insert with check (user_id = auth.uid());

drop policy if exists "suggerimenti: leggi i propri" on public.suggerimenti;
create policy "suggerimenti: leggi i propri" on public.suggerimenti
  for select using (user_id = auth.uid());
