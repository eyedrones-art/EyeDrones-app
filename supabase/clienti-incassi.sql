-- Rubrica clienti e incassi dei preventivi (pagine "Clienti" e "Preventivi")
create table if not exists public.clienti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  telefono text,
  email text,
  indirizzo text,
  piva_cf text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists clienti_utente on public.clienti (user_id, nome);

alter table public.clienti enable row level security;

drop policy if exists "clienti: solo i propri" on public.clienti;
create policy "clienti: solo i propri" on public.clienti
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- pagato / da incassare sui preventivi accettati
alter table public.preventivi add column if not exists pagato boolean not null default false;
alter table public.preventivi add column if not exists data_pagamento date;
