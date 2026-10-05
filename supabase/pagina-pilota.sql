-- Eyedrones — pagina pubblica del pilota (app.eyedrones.it/p/nome) e richieste di preventivo dai clienti
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi. L'app funziona anche prima: la pagina "La mia pagina" avvisa di eseguire lo script.

-- 1) la pagina: una per pilota, visibile a tutti solo quando è "attiva"
create table if not exists public.pagine_pilota (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  slug text not null unique,                 -- l'indirizzo: app.eyedrones.it/p/<slug>
  attiva boolean not null default false,
  nome text,                                 -- nome mostrato (se vuoto: nome azienda)
  presentazione text,
  citta text,
  provincia text,                            -- sigla, es. MI
  raggio_km int,                             -- fin dove si sposta
  servizi text[] not null default '{}',
  abilitazioni text[] not null default '{}', -- dichiarate dal pilota (scelte tra i suoi attestati)
  codice_operatore text,                     -- ITA... (è già scritto sul QR del drone)
  assicurato boolean not null default false,
  telefono text,
  whatsapp text,
  email text,
  sito text,
  instagram text,
  portfolio jsonb not null default '[]',     -- [{ url, tipo, nome }] scelti tra le proprie foto e video
  visite int not null default 0,
  aggiornata_il timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint pagine_pilota_slug_ok check (slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$')
);

create index if not exists pagine_pilota_provincia_idx on public.pagine_pilota (provincia) where attiva;

alter table public.pagine_pilota enable row level security;

drop policy if exists "pagine_pilota_select" on public.pagine_pilota;
drop policy if exists "pagine_pilota_insert" on public.pagine_pilota;
drop policy if exists "pagine_pilota_update" on public.pagine_pilota;
drop policy if exists "pagine_pilota_delete" on public.pagine_pilota;
create policy "pagine_pilota_select" on public.pagine_pilota for select using (auth.uid() = user_id);
create policy "pagine_pilota_insert" on public.pagine_pilota for insert with check (auth.uid() = user_id);
create policy "pagine_pilota_update" on public.pagine_pilota for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "pagine_pilota_delete" on public.pagine_pilota for delete using (auth.uid() = user_id);

-- 2) le richieste arrivate dalla pagina: le vede solo il pilota
create table if not exists public.richieste_preventivo (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- il pilota che la riceve
  nome text not null,
  email text,
  telefono text,
  servizio text,
  luogo text,
  data_desiderata date,
  descrizione text,
  stato text not null default 'nuova',      -- nuova | letta | preventivo | archiviata
  created_at timestamptz not null default now()
);

create index if not exists richieste_preventivo_user_idx on public.richieste_preventivo (user_id, created_at desc);

alter table public.richieste_preventivo enable row level security;

-- nessuna policy di insert: i clienti scrivono solo tramite la funzione invia_richiesta_preventivo
drop policy if exists "richieste_select" on public.richieste_preventivo;
drop policy if exists "richieste_update" on public.richieste_preventivo;
drop policy if exists "richieste_delete" on public.richieste_preventivo;
create policy "richieste_select" on public.richieste_preventivo for select using (auth.uid() = user_id);
create policy "richieste_update" on public.richieste_preventivo for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "richieste_delete" on public.richieste_preventivo for delete using (auth.uid() = user_id);

-- 3) l'indirizzo è libero? (controllo mentre il pilota lo scrive; non rivela nient'altro)
create or replace function public.slug_pilota_libero(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (select 1 from public.pagine_pilota where slug = lower(p_slug) and user_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid));
$$;

revoke all on function public.slug_pilota_libero(text) from public;
grant execute on function public.slug_pilota_libero(text) to authenticated;

-- 4) pagina pubblica: dato lo slug restituisce SOLO i campi pubblici, e solo se la pagina è attiva.
-- security definer = legge i dati senza aprire a tutti le tabelle pagine_pilota / profili.
create or replace function public.pagina_pilota(p_slug text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'slug', g.slug,
    'nome', coalesce(nullif(g.nome, ''), p.azienda_nome),
    'logo', p.azienda_logo,
    'presentazione', g.presentazione,
    'citta', g.citta,
    'provincia', g.provincia,
    'raggio_km', g.raggio_km,
    'servizi', g.servizi,
    'abilitazioni', g.abilitazioni,
    'codice_operatore', g.codice_operatore,
    'assicurato', g.assicurato,
    'telefono', g.telefono,
    'whatsapp', g.whatsapp,
    'email', g.email,
    'sito', g.sito,
    'instagram', g.instagram,
    'portfolio', g.portfolio,
    'aggiornata_il', g.aggiornata_il
  )
  from public.pagine_pilota g
  left join public.profili p on p.user_id = g.user_id
  where g.slug = lower(p_slug) and g.attiva
  limit 1;
$$;

revoke all on function public.pagina_pilota(text) from public;
grant execute on function public.pagina_pilota(text) to anon, authenticated;

-- 5) contatore delle visite (una chiamata per apertura della pagina)
create or replace function public.visita_pagina_pilota(p_slug text)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.pagine_pilota set visite = visite + 1 where slug = lower(p_slug) and attiva;
$$;

revoke all on function public.visita_pagina_pilota(text) from public;
grant execute on function public.visita_pagina_pilota(text) to anon, authenticated;

-- 6) il cliente invia una richiesta: controlli sui campi e limiti contro lo spam
create or replace function public.invia_richiesta_preventivo(
  p_slug text,
  p_nome text,
  p_email text,
  p_telefono text,
  p_servizio text,
  p_luogo text,
  p_data date,
  p_descrizione text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pilota uuid;
  v_nome text := left(btrim(coalesce(p_nome, '')), 80);
  v_email text := nullif(left(lower(btrim(coalesce(p_email, ''))), 120), '');
  v_tel text := nullif(left(btrim(coalesce(p_telefono, '')), 30), '');
begin
  select user_id into v_pilota from public.pagine_pilota where slug = lower(p_slug) and attiva;
  if v_pilota is null then raise exception 'pagina non disponibile'; end if;
  if length(v_nome) < 2 then raise exception 'nome mancante'; end if;
  if v_email is null and v_tel is null then raise exception 'serve email o telefono'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email non valida'; end if;

  -- stessa persona: al massimo 3 richieste all'ora allo stesso pilota; in tutto al massimo 40 al giorno per pilota
  if (select count(*) from public.richieste_preventivo
      where user_id = v_pilota and created_at > now() - interval '1 hour'
        and ((v_email is not null and email = v_email) or (v_tel is not null and telefono = v_tel))) >= 3
  then raise exception 'troppe richieste'; end if;
  if (select count(*) from public.richieste_preventivo where user_id = v_pilota and created_at > now() - interval '1 day') >= 40
  then raise exception 'troppe richieste'; end if;

  insert into public.richieste_preventivo (user_id, nome, email, telefono, servizio, luogo, data_desiderata, descrizione)
  values (
    v_pilota, v_nome, v_email, v_tel,
    nullif(left(btrim(coalesce(p_servizio, '')), 80), ''),
    nullif(left(btrim(coalesce(p_luogo, '')), 120), ''),
    case when p_data >= current_date and p_data < current_date + 730 then p_data end,
    nullif(left(btrim(coalesce(p_descrizione, '')), 2000), '')
  );
  return true;
end;
$$;

revoke all on function public.invia_richiesta_preventivo(text, text, text, text, text, text, date, text) from public;
grant execute on function public.invia_richiesta_preventivo(text, text, text, text, text, text, date, text) to anon, authenticated;
