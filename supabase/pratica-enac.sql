-- EyeDrones — «Pratica ENAC»: bozza del Manuale delle Operazioni per gli scenari standard STS-01 e STS-02.
-- Una riga per utente con i dati del modulo (jsonb). Una volta sola: SQL Editor → incolla → Run. Si può rieseguire.
create table if not exists public.pratica_enac (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  dati jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pratica_enac enable row level security;
drop policy if exists "pratica_enac: solo la propria" on public.pratica_enac;
create policy "pratica_enac: solo la propria" on public.pratica_enac
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.pratica_enac from anon;
grant select, insert, update, delete on public.pratica_enac to authenticated;
select 'Pratica ENAC pronta' as fatto;
