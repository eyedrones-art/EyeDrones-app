-- EyeDrones — cartelle «🎬 Foto e video» e «🥽 FPV»: contratti per le riprese, inquadrature scelte dal cliente,
-- piani della giornata, percorsi sulla piantina, batterie LiPo e piani delle frequenze.
-- Una sola tabella (documenti_lavoro) con un campo «tipo»; l'osservatore FPV si salva nel volo (voli.dettagli).
-- Da eseguire una volta: SQL Editor → Run. Si può rieseguire.
-- Se c'è la «👥 Squadra» (squadra.sql), i documenti si vedono anche dal collega, tranne quelli «🔒 Solo mio».

create table if not exists public.documenti_lavoro (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('giornata', 'contratto', 'inquadrature', 'percorso', 'lipo', 'frequenze')),
  titolo text,
  dati jsonb not null default '{}'::jsonb,
  -- link per il cliente (solo «inquadrature»): chi ha il link vede le scene proposte e risponde
  token uuid not null unique default gen_random_uuid(),
  stato text not null default 'bozza',
  risposta jsonb,
  risposto_il timestamptz,
  solo_mio boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists documenti_lavoro_utente on public.documenti_lavoro (user_id, tipo, created_at desc);

alter table public.documenti_lavoro enable row level security;
drop policy if exists "documenti_lavoro: solo i propri" on public.documenti_lavoro;
create policy "documenti_lavoro: solo i propri" on public.documenti_lavoro for all using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.documenti_lavoro to authenticated;

-- squadra (se c'è): il collega vede e modifica, tranne «Solo mio»
do $$
begin
  if to_regprocedure('public.squadra_vede(uuid)') is not null then
    drop policy if exists "squadra_vede" on public.documenti_lavoro;
    drop policy if exists "squadra_modifica" on public.documenti_lavoro;
    create policy "squadra_vede" on public.documenti_lavoro for select to authenticated using (public.squadra_vede(user_id) and not solo_mio);
    create policy "squadra_modifica" on public.documenti_lavoro for update to authenticated using (public.squadra_vede(user_id) and not solo_mio) with check (public.squadra_vede(user_id));
    if to_regprocedure('privato.metti_solo_mio()') is not null then
      drop trigger if exists squadra_solo_mio on public.documenti_lavoro;
      create trigger squadra_solo_mio before insert on public.documenti_lavoro for each row execute function privato.metti_solo_mio();
    end if;
  end if;
end $$;

-- il cliente apre il link delle inquadrature (anche senza account)
create or replace function public.inquadrature_leggi(p_token uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('titolo', d.titolo, 'dati', d.dati, 'risposta', d.risposta, 'stato', d.stato)
  from public.documenti_lavoro d
  where d.token = p_token and d.tipo = 'inquadrature' and d.stato in ('inviato', 'risposto');
$$;

-- il cliente manda le scene scelte (si può rimandare finché il pilota non chiude)
create or replace function public.inquadrature_rispondi(p_token uuid, p_risposta jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_risposta is null or jsonb_typeof(p_risposta) <> 'object' or pg_column_size(p_risposta) > 20000 then
    raise exception 'Risposta non valida';
  end if;
  update public.documenti_lavoro
     set risposta = p_risposta, risposto_il = now(), stato = 'risposto', updated_at = now()
   where token = p_token and tipo = 'inquadrature' and stato in ('inviato', 'risposto');
  return found;
end $$;

revoke all on function public.inquadrature_leggi(uuid) from public;
revoke all on function public.inquadrature_rispondi(uuid, jsonb) from public;
grant execute on function public.inquadrature_leggi(uuid) to anon, authenticated;
grant execute on function public.inquadrature_rispondi(uuid, jsonb) to anon, authenticated;

select 'Foto e video, FPV: pronti' as fatto;
