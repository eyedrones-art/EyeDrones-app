-- 1) Preventivi: entro quando il cliente deve pagare (per gli avvisi di ritardo)
alter table public.preventivi add column if not exists scadenza_pagamento date;

-- 2) Piloti che vogliono collaborare con EyeDrones (pagina «Collabora con EyeDrones»)
create table if not exists public.candidature_collaborazione (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  citta text,
  provincia text,
  raggio_km int,
  servizi text[] not null default '{}',
  attestati jsonb not null default '[]',   -- [{ tipo, scadenza }] copiati dagli attestati del pilota
  droni jsonb not null default '[]',       -- [{ nome, classe }]
  esperienza text,
  disponibilita text,
  portfolio text,
  pagina_slug text,
  telefono text,
  email text,
  note text,
  aggiornata_il timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.candidature_collaborazione enable row level security;

-- il pilota vede e modifica solo la sua; l'amministratore di EyeDrones le vede tutte
drop policy if exists "candidature: la mia" on public.candidature_collaborazione;
create policy "candidature: la mia" on public.candidature_collaborazione
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "candidature: amministratore legge" on public.candidature_collaborazione;
create policy "candidature: amministratore legge" on public.candidature_collaborazione
  for select using ((auth.jwt() ->> 'email') in ('eyedrones@libero.it', 'ravinale.ivan@libero.it'));

-- 3) Note private dell'amministratore sui candidati (il pilota non le vede)
create table if not exists public.note_collaboratori (
  candidato_id uuid primary key references public.candidature_collaborazione(user_id) on delete cascade,
  stato text not null default 'nuova',      -- nuova | contattato | collabora | non_adatto
  nota text,
  aggiornata_il timestamptz not null default now()
);

alter table public.note_collaboratori enable row level security;

drop policy if exists "note_collaboratori: solo amministratore" on public.note_collaboratori;
create policy "note_collaboratori: solo amministratore" on public.note_collaboratori
  for all using ((auth.jwt() ->> 'email') in ('eyedrones@libero.it', 'ravinale.ivan@libero.it'))
  with check ((auth.jwt() ->> 'email') in ('eyedrones@libero.it', 'ravinale.ivan@libero.it'));
