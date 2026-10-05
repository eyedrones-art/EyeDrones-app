-- 1) Preventivi: entro quando il cliente deve pagare (per gli avvisi di ritardo)
alter table public.preventivi add column if not exists scadenza_pagamento date;

-- 2) I miei collaboratori: la rubrica privata dei piloti con cui lavori (ognuno vede solo i suoi)
create table if not exists public.collaboratori (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  citta text,
  provincia text,
  raggio_km int,
  servizi text[] not null default '{}',
  attestati jsonb not null default '[]',   -- [{ tipo, scadenza }]
  droni text,
  esperienza text,
  disponibilita text,
  portfolio text,
  telefono text,
  email text,
  stato text not null default 'contatto',  -- contatto | prova | collabora | non_adatto
  note text,
  created_at timestamptz not null default now(),
  aggiornato_il timestamptz not null default now()
);

create index if not exists collaboratori_utente on public.collaboratori (user_id, nome);

alter table public.collaboratori enable row level security;

drop policy if exists "collaboratori: solo i miei" on public.collaboratori;
create policy "collaboratori: solo i miei" on public.collaboratori
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
