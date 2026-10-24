-- EyeDrones — Esperto (AI) a pacchetti: crediti per le analisi delle foto.
-- Ogni iscritto ha 3 analisi gratis per provare; poi compra un pacchetto (Stripe) e i crediti arrivano da soli.
-- Una volta sola: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza danni.
-- Serve aver già eseguito errori-spazio-promemoria.sql (crea privato.impostazioni con il codice segreto 'avviso_segreto').

create schema if not exists privato;

-- quanti crediti ha ognuno (li cambiano solo le funzioni qui sotto, mai il telefono)
create table if not exists public.esperto_crediti (
  user_id uuid primary key references auth.users(id) on delete cascade,
  crediti integer not null default 0 check (crediti >= 0),
  gratis_dati boolean not null default false,
  aggiornato timestamptz not null default now()
);
alter table public.esperto_crediti enable row level security;
drop policy if exists "crediti: leggo solo i miei" on public.esperto_crediti;
create policy "crediti: leggo solo i miei" on public.esperto_crediti for select using (user_id = auth.uid());
revoke insert, update, delete on public.esperto_crediti from anon, authenticated;

-- gli acquisti (uno per pagamento Stripe: lo stesso pagamento non può dare crediti due volte)
create table if not exists public.esperto_acquisti (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pacchetto text not null,
  crediti integer not null,
  importo_centesimi integer,
  sessione text unique not null,
  creato timestamptz not null default now()
);
alter table public.esperto_acquisti enable row level security;
drop policy if exists "acquisti: leggo solo i miei" on public.esperto_acquisti;
create policy "acquisti: leggo solo i miei" on public.esperto_acquisti for select using (user_id = auth.uid());
revoke insert, update, delete on public.esperto_acquisti from anon, authenticated;

-- le analisi fatte (per i numeri: quante, di che tipo, quanto sono costate)
create table if not exists public.esperto_uso (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tipo text,
  costo_centesimi numeric,
  creato timestamptz not null default now()
);
alter table public.esperto_uso enable row level security;
drop policy if exists "uso: leggo solo il mio" on public.esperto_uso;
create policy "uso: leggo solo il mio" on public.esperto_uso for select using (user_id = auth.uid());
revoke insert, update, delete on public.esperto_uso from anon, authenticated;

-- quanti crediti ho: la prima volta regala le 3 analisi di prova
create or replace function public.crediti_esperto()
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if auth.uid() is null then return 0; end if;
  insert into public.esperto_crediti (user_id, crediti, gratis_dati) values (auth.uid(), 3, true)
  on conflict (user_id) do nothing;
  select crediti into v from public.esperto_crediti where user_id = auth.uid();
  return coalesce(v, 0);
end; $$;
revoke all on function public.crediti_esperto() from public, anon;
grant execute on function public.crediti_esperto() to authenticated;

-- usa un credito dopo un'analisi riuscita (può solo togliere, mai aggiungere). Restituisce i crediti rimasti
create or replace function public.usa_credito_esperto(p_tipo text, p_costo numeric)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.esperto_crediti set crediti = greatest(crediti - 1, 0), aggiornato = now() where user_id = auth.uid() returning crediti into v;
  insert into public.esperto_uso (user_id, tipo, costo_centesimi) values (auth.uid(), left(p_tipo, 30), p_costo);
  return coalesce(v, 0);
end; $$;
revoke all on function public.usa_credito_esperto(text, numeric) from public, anon;
grant execute on function public.usa_credito_esperto(text, numeric) to authenticated;

-- aggiunge i crediti di un pacchetto pagato: la chiama solo la funzione Netlify di Stripe, con il codice segreto
create or replace function public.aggiungi_crediti_esperto(p_utente uuid, p_crediti integer, p_pacchetto text, p_sessione text, p_importo integer, p_segreto text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_segreto text;
begin
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_segreto is null or p_segreto is distinct from v_segreto then return false; end if;
  if p_crediti is null or p_crediti <= 0 or p_crediti > 1000 then return false; end if;
  insert into public.esperto_acquisti (user_id, pacchetto, crediti, importo_centesimi, sessione)
  values (p_utente, left(p_pacchetto, 30), p_crediti, p_importo, p_sessione)
  on conflict (sessione) do nothing;
  if not found then return true; end if; -- già registrato: niente crediti doppi
  insert into public.esperto_crediti (user_id, crediti) values (p_utente, p_crediti)
  on conflict (user_id) do update set crediti = public.esperto_crediti.crediti + excluded.crediti, aggiornato = now();
  return true;
end; $$;
revoke all on function public.aggiungi_crediti_esperto(uuid, integer, text, text, integer, text) from public;
grant execute on function public.aggiungi_crediti_esperto(uuid, integer, text, text, integer, text) to anon, authenticated;

-- i numeri dell'Esperto (da rilanciare quando vuoi)
select
  (select count(*) from public.esperto_crediti) as hanno_provato,
  (select count(*) from public.esperto_uso) as analisi_fatte,
  (select count(distinct user_id) from public.esperto_acquisti) as hanno_comprato,
  (select coalesce(sum(importo_centesimi), 0) / 100.0 from public.esperto_acquisti) as incassato_euro,
  (select round(coalesce(sum(costo_centesimi), 0) / 100.0, 2) from public.esperto_uso) as costo_ai_dollari;
