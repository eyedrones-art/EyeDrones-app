-- EyeDrones — Agricoltura: «🛰️ Mappe e scouting». Mappe di indice (NDVI, NDRE…) per campo con lo storico,
-- punti di scouting georiferiti e (nel telefono) le mappe di prescrizione a zone da esportare per l'Agras.
-- Del GeoTIFF salvo solo un'anteprima piccola, i limiti, le statistiche e una griglia: il file resta al pilota.
-- Serve aver già eseguito agricoltura.sql. Da eseguire una volta: SQL Editor → Run. Si può rieseguire.
-- Se c'è la «👥 Squadra» (squadra.sql), mappe e punti si vedono anche dal collega, tranne quelli «🔒 Solo mio».

create table if not exists public.mappe_campo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  appezzamento_id uuid references public.appezzamenti(id) on delete cascade,
  data date not null default current_date,
  indice text not null default 'NDVI',
  fonte text,
  nome_file text,
  immagine text,
  angoli jsonb,
  statistiche jsonb,
  griglia jsonb,
  colorata boolean not null default false,
  note text,
  solo_mio boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mappe_campo_utente on public.mappe_campo (user_id, appezzamento_id, data desc);

create table if not exists public.punti_scouting (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  appezzamento_id uuid references public.appezzamenti(id) on delete cascade,
  mappa_id uuid references public.mappe_campo(id) on delete set null,
  lat double precision not null,
  lon double precision not null,
  data date not null default current_date,
  categoria text not null default 'altro',
  nota text,
  risolto boolean not null default false,
  solo_mio boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists punti_scouting_utente on public.punti_scouting (user_id, appezzamento_id, data desc);

do $$
declare t text;
begin
  foreach t in array array['mappe_campo', 'punti_scouting'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%s: solo i propri" on public.%I', t, t);
    execute format('create policy "%s: solo i propri" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t, t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    -- squadra (se c'è): il collega vede e modifica, tranne «Solo mio»
    if to_regprocedure('public.squadra_vede(uuid)') is not null then
      execute format('drop policy if exists "squadra_vede" on public.%I', t);
      execute format('drop policy if exists "squadra_modifica" on public.%I', t);
      execute format('create policy "squadra_vede" on public.%I for select to authenticated using (public.squadra_vede(user_id) and not solo_mio)', t);
      execute format('create policy "squadra_modifica" on public.%I for update to authenticated using (public.squadra_vede(user_id) and not solo_mio) with check (public.squadra_vede(user_id))', t);
      if to_regprocedure('privato.metti_solo_mio()') is not null then
        execute format('drop trigger if exists squadra_solo_mio on public.%I', t);
        execute format('create trigger squadra_solo_mio before insert on public.%I for each row execute function privato.metti_solo_mio()', t);
      end if;
    end if;
  end loop;
end $$;

select 'Mappe e scouting pronti' as fatto;
