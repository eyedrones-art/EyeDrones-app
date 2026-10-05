-- Posti consigliati dai piloti (pagina "Posti"): visibili a tutti gli utenti registrati, anonimi
create table if not exists public.posti_consigliati (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  lat double precision not null,
  lon double precision not null,
  tipo text,
  nota text,
  voto smallint check (voto between 1 and 5),
  created_at timestamptz not null default now()
);

create index if not exists posti_consigliati_luogo on public.posti_consigliati (lat, lon);

alter table public.posti_consigliati enable row level security;

-- tutti gli utenti registrati vedono i consigli (senza sapere chi li ha scritti: l'app non mostra user_id)
drop policy if exists "posti: lettura per gli utenti" on public.posti_consigliati;
create policy "posti: lettura per gli utenti" on public.posti_consigliati
  for select to authenticated using (true);

drop policy if exists "posti: scrivo i miei" on public.posti_consigliati;
create policy "posti: scrivo i miei" on public.posti_consigliati
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "posti: modifico i miei" on public.posti_consigliati;
create policy "posti: modifico i miei" on public.posti_consigliati
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "posti: cancello i miei" on public.posti_consigliati;
create policy "posti: cancello i miei" on public.posti_consigliati
  for delete to authenticated using (user_id = auth.uid());
