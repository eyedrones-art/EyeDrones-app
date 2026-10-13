-- EyeDrones — Agricoltura (fase 1): appezzamenti con i confini e registro trattamenti.
-- Una volta sola: incolla tutto nello SQL Editor di Supabase e premi Run. Si può rieseguire senza danni.

-- Appezzamenti: cliente → azienda → campo, con il confine (GeoJSON Polygon/MultiPolygon in gradi, lon/lat)
create table if not exists public.appezzamenti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  cliente_id uuid references public.clienti(id) on delete set null,
  azienda text,
  nome text not null,
  coltura text,
  ettari numeric,
  confini jsonb,
  centro_lat double precision,
  centro_lon double precision,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists appezzamenti_utente on public.appezzamenti (user_id, azienda, nome);
alter table public.appezzamenti enable row level security;
drop policy if exists "appezzamenti: solo i propri" on public.appezzamenti;
create policy "appezzamenti: solo i propri" on public.appezzamenti
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Registro trattamenti: cosa, dove, quanto, con che meteo e chi l'ha fatto (resta anche se il campo viene cancellato)
create table if not exists public.trattamenti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  appezzamento_id uuid references public.appezzamenti(id) on delete set null,
  campo_nome text,
  azienda text,
  data date not null default current_date,
  ora_inizio time,
  ora_fine time,
  tipo text not null default 'trattamento',
  coltura text,
  avversita text,
  prodotto text,
  registrazione text,
  dose numeric,
  unita text default 'l/ha',
  volume_ha numeric,
  ettari numeric,
  quantita_totale numeric,
  drone_id text,
  drone_nome text,
  operatore text,
  vento_kmh numeric,
  direzione_vento text,
  temperatura numeric,
  umidita numeric,
  note text,
  created_at timestamptz not null default now()
);
create index if not exists trattamenti_utente on public.trattamenti (user_id, data desc);
alter table public.trattamenti enable row level security;
drop policy if exists "trattamenti: solo i propri" on public.trattamenti;
create policy "trattamenti: solo i propri" on public.trattamenti
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Manutenzione dei droni agricoli: le ore (motore del generatore, pompe, volo) accanto all'intervento
alter table public.manutenzioni_droni add column if not exists ore numeric;
