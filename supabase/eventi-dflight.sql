-- Eyedrones — segnalazione eventi di volo e scadenze D-Flight
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi. L'app funziona anche prima: queste funzioni restano solo nascoste.

-- scadenza dell'abbonamento D-Flight (il QR code operatore vale solo con abbonamento attivo)
alter table public.profili add column if not exists dflight_scadenza date;

-- per ogni drone: il nuovo QR code D-Flight (generato da ottobre 2025) è stato stampato e applicato?
alter table public.droni add column if not exists qr_dflight_nuovo boolean not null default false;

-- eventi di volo da segnalare (Reg. UE 2026/1821, ENAC SPL-21: entro 72 ore)
create table if not exists public.eventi_volo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  volo_id text not null,            -- id del volo (testo, come in "condivisioni")
  data_ora timestamptz not null,    -- quando è successo
  tipo text not null,
  descrizione text,
  feriti boolean not null default false,
  danni_terzi boolean not null default false,
  segnalato boolean not null default false,
  segnalato_il timestamptz,
  riferimento text,                 -- numero/protocollo della segnalazione inviata
  created_at timestamptz not null default now()
);

create index if not exists eventi_volo_volo_idx on public.eventi_volo (volo_id);

alter table public.eventi_volo enable row level security;

drop policy if exists "eventi_volo_select" on public.eventi_volo;
drop policy if exists "eventi_volo_insert" on public.eventi_volo;
drop policy if exists "eventi_volo_update" on public.eventi_volo;
drop policy if exists "eventi_volo_delete" on public.eventi_volo;
create policy "eventi_volo_select" on public.eventi_volo for select using (auth.uid() = user_id);
create policy "eventi_volo_insert" on public.eventi_volo for insert
  with check (auth.uid() = user_id and exists (select 1 from public.voli v where v.id::text = volo_id));
create policy "eventi_volo_update" on public.eventi_volo for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "eventi_volo_delete" on public.eventi_volo for delete using (auth.uid() = user_id);
