-- EyeDrones — Agricoltura: «📋 Ordini di lavoro». Il terzista prepara il lavoro prima di farlo:
-- campo, tipo (trattamento, concimazione, semina, rilievo), data, drone, pilota, prodotto e dose.
-- Quando è fatto, con un tocco diventa una riga del registro lavori (trattamenti).
-- Serve aver già eseguito agricoltura.sql. Da eseguire una volta: SQL Editor → Run. Si può rieseguire.
-- Se c'è la «👥 Squadra» (squadra.sql), ordini, campi e registro lavori si vedono anche dal collega,
-- tranne quelli segnati «🔒 Solo mio».

create table if not exists public.ordini_lavoro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  appezzamento_id uuid references public.appezzamenti(id) on delete set null,
  campo_nome text,
  azienda text,
  tipo text not null default 'trattamento',
  data date,
  ora text,
  coltura text,
  avversita text,
  prodotto text,
  dose numeric,
  unita text default 'l/ha',
  volume_ha numeric,
  ettari numeric,
  drone_id text,
  drone_nome text,
  pilota text,
  stato text not null default 'da_fare' check (stato in ('da_fare', 'fatto', 'annullato')),
  fatto_il timestamptz,
  note text,
  solo_mio boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ordini_lavoro_utente on public.ordini_lavoro (user_id, stato, data);
alter table public.ordini_lavoro enable row level security;
drop policy if exists "ordini_lavoro: solo i propri" on public.ordini_lavoro;
create policy "ordini_lavoro: solo i propri" on public.ordini_lavoro
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.ordini_lavoro to authenticated;

-- Squadra: se squadra.sql è già stato eseguito, il collega vede e modifica anche ordini, campi e registro lavori
do $$
declare t text;
begin
  if to_regprocedure('public.squadra_vede(uuid)') is null then return; end if;
  foreach t in array array['ordini_lavoro', 'appezzamenti', 'trattamenti'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('alter table public.%I add column if not exists solo_mio boolean not null default false', t);
    execute format('drop policy if exists "squadra_vede" on public.%I', t);
    execute format('drop policy if exists "squadra_modifica" on public.%I', t);
    execute format('create policy "squadra_vede" on public.%I for select to authenticated using (public.squadra_vede(user_id) and not solo_mio)', t);
    execute format('create policy "squadra_modifica" on public.%I for update to authenticated using (public.squadra_vede(user_id) and not solo_mio) with check (public.squadra_vede(user_id))', t);
    if to_regprocedure('privato.metti_solo_mio()') is not null then
      execute format('drop trigger if exists squadra_solo_mio on public.%I', t);
      execute format('create trigger squadra_solo_mio before insert on public.%I for each row execute function privato.metti_solo_mio()', t);
    end if;
  end loop;
end $$;

select 'Ordini di lavoro pronti' as fatto;
