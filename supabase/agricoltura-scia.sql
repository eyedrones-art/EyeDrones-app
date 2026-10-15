-- EyeDrones — Agricoltura: fascicolo per la SCIA dei trattamenti con drone (Legge 182/2025, art. 13-bis D.lgs 150/2012).
-- Una volta sola: incolla tutto nello SQL Editor di Supabase e premi Run. Si può rieseguire senza danni.
-- Un fascicolo per utente: impresa, piloti, droni, assicurazione, relazione agronomica, dati della SCIA (in un campo jsonb,
-- così si possono aggiungere voci quando esce il decreto attuativo senza cambiare la tabella).
create table if not exists public.agri_fascicolo (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  dati jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.agri_fascicolo enable row level security;
drop policy if exists "agri_fascicolo: solo il proprio" on public.agri_fascicolo;
create policy "agri_fascicolo: solo il proprio" on public.agri_fascicolo
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
