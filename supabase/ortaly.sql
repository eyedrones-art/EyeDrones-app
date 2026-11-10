-- ORTALY — da incollare nel progetto Supabase DI ORTALY (non in quello di EyeDrones), in SQL Editor → Run.
-- Si può rieseguire: non cancella dati.
--
-- Botteghe (una per produttore), prodotti, ordini dei clienti, foto.
-- I clienti ordinano senza account; ogni produttore vede e cambia solo la sua bottega e i suoi ordini.
-- Abbonamento: 19 € al mese, i primi 3 mesi sono inclusi (prova_fino).

create extension if not exists pgcrypto;

-- ── tabelle ────────────────────────────────────────────────────────────────
create table if not exists public.botteghe (
  id uuid primary key default gen_random_uuid(),
  utente uuid not null unique references auth.users(id) on delete cascade default auth.uid(),
  nome text not null check (char_length(btrim(nome)) between 2 and 60),
  paese text not null check (char_length(btrim(paese)) between 2 and 40),
  provincia text not null check (provincia ~ '^[A-Z]{2}$'),
  tipo text check (char_length(tipo) <= 60),
  storia text check (char_length(storia) <= 400),
  foto text check (char_length(foto) <= 500),
  telefono text not null check (char_length(regexp_replace(telefono, '\D', '', 'g')) between 6 and 15),
  piva text not null check (regexp_replace(piva, '\D', '', 'g') ~ '^\d{11}$'),
  consegna_casa text check (char_length(consegna_casa) <= 120),   -- vuoto = non porta a casa
  ritiro text check (char_length(ritiro) <= 120),                 -- vuoto = niente ritiro in azienda
  spedizione text check (char_length(spedizione) <= 120),         -- vuoto = non spedisce in Italia
  bio boolean not null default false,
  visibile boolean not null default true,                         -- EyeDrones può nascondere una bottega
  prova_fino date not null default (current_date + interval '3 months')::date,
  abbonamento text not null default 'prova' check (abbonamento in ('prova', 'attivo', 'scaduto', 'disdetto')),
  creata timestamptz not null default now(),
  check (coalesce(consegna_casa, ritiro, spedizione) is not null)
);

create table if not exists public.prodotti (
  id uuid primary key default gen_random_uuid(),
  bottega uuid not null references public.botteghe(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 50),
  categoria text not null check (categoria in ('Verdura', 'Frutta', 'Uova e latticini', 'Formaggi', 'Carne e salumi', 'Miele e conserve', 'Vino e olio', 'Pane e farine', 'Altro')),
  unita text not null check (char_length(unita) between 1 and 30),
  prezzo numeric(8,2) not null check (prezzo > 0 and prezzo < 10000),
  nota text check (char_length(nota) <= 60),
  foto text check (char_length(foto) <= 500),
  disponibile boolean not null default true,
  creato timestamptz not null default now()
);
create index if not exists prodotti_bottega on public.prodotti(bottega);

create table if not exists public.ordini (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique default upper(substr(md5(gen_random_uuid()::text), 1, 6)),
  bottega uuid not null references public.botteghe(id) on delete cascade,
  cliente_nome text not null check (char_length(btrim(cliente_nome)) between 2 and 60),
  cliente_telefono text not null check (char_length(regexp_replace(cliente_telefono, '\D', '', 'g')) between 6 and 15),
  cliente_email text check (cliente_email is null or cliente_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  modo text not null check (modo in ('casa', 'ritiro', 'spedizione')),
  indirizzo text check (char_length(indirizzo) <= 200),
  nota text check (char_length(nota) <= 300),
  righe jsonb not null,
  totale numeric(10,2) not null,
  stato text not null default 'nuovo' check (stato in ('nuovo', 'accettato', 'pronto', 'consegnato', 'annullato')),
  avvisato boolean not null default false,
  creato timestamptz not null default now()
);
create index if not exists ordini_bottega on public.ordini(bottega, creato desc);

-- ── chi vede cosa ──────────────────────────────────────────────────────────
alter table public.botteghe enable row level security;
alter table public.prodotti enable row level security;
alter table public.ordini enable row level security;

drop policy if exists "bottega mia" on public.botteghe;
create policy "bottega mia" on public.botteghe for all to authenticated
  using (utente = auth.uid()) with check (utente = auth.uid());

drop policy if exists "prodotti miei" on public.prodotti;
create policy "prodotti miei" on public.prodotti for all to authenticated
  using (bottega in (select id from public.botteghe where utente = auth.uid()))
  with check (bottega in (select id from public.botteghe where utente = auth.uid()));

drop policy if exists "ordini miei" on public.ordini;
create policy "ordini miei" on public.ordini for select to authenticated
  using (bottega in (select id from public.botteghe where utente = auth.uid()));
drop policy if exists "ordini miei stato" on public.ordini;
create policy "ordini miei stato" on public.ordini for update to authenticated
  using (bottega in (select id from public.botteghe where utente = auth.uid()))
  with check (bottega in (select id from public.botteghe where utente = auth.uid()));

-- il produttore non può cambiare da solo visibilità, prova e abbonamento, né gli ordini oltre allo stato
revoke update on public.botteghe from authenticated;
grant select, insert, delete on public.botteghe to authenticated;
grant update (nome, paese, provincia, tipo, storia, foto, telefono, piva, consegna_casa, ritiro, spedizione, bio) on public.botteghe to authenticated;
grant select, insert, update, delete on public.prodotti to authenticated;
revoke insert, update, delete on public.ordini from authenticated, anon;
grant select on public.ordini to authenticated;
grant update (stato) on public.ordini to authenticated;
revoke all on public.botteghe, public.prodotti, public.ordini from anon;

-- alla creazione la prova parte sempre da oggi, qualunque cosa mandi il telefono
create or replace function public.bottega_nuova() returns trigger language plpgsql as $$
begin
  new.utente := auth.uid();
  new.visibile := true;
  new.prova_fino := (current_date + interval '3 months')::date;
  new.abbonamento := 'prova';
  new.provincia := upper(new.provincia);
  return new;
end $$;
drop trigger if exists bottega_nuova on public.botteghe;
create trigger bottega_nuova before insert on public.botteghe for each row execute function public.bottega_nuova();

-- ── vetrina pubblica (senza telefono e partita IVA) ────────────────────────
create or replace view public.vetrina_botteghe with (security_invoker = false) as
  select id, nome, paese, provincia, tipo, storia, foto, consegna_casa, ritiro, spedizione, bio, creata
  from public.botteghe
  where visibile and (abbonamento = 'attivo' or (abbonamento = 'prova' and prova_fino >= current_date));

create or replace view public.vetrina_prodotti with (security_invoker = false) as
  select p.id, p.bottega, p.nome, p.categoria, p.unita, p.prezzo, p.nota, p.foto, p.creato
  from public.prodotti p join public.vetrina_botteghe b on b.id = p.bottega
  where p.disponibile;

grant select on public.vetrina_botteghe, public.vetrina_prodotti to anon, authenticated;

-- ── ordine del cliente: i prezzi li prende dal database, non dal telefono ──
create or replace function public.ordina(
  p_bottega uuid, p_righe jsonb, p_nome text, p_telefono text, p_email text,
  p_modo text, p_indirizzo text, p_nota text
) returns json language plpgsql security definer set search_path = public as $$
declare
  b record; r jsonb; p record; righe jsonb := '[]'::jsonb; tot numeric := 0; q int; o record; recenti int;
begin
  select * into b from public.vetrina_botteghe where id = p_bottega;
  if b.id is null then raise exception 'Questa bottega non riceve ordini in questo momento'; end if;
  if (p_modo = 'casa' and b.consegna_casa is null) or (p_modo = 'ritiro' and b.ritiro is null)
     or (p_modo = 'spedizione' and b.spedizione is null) or p_modo not in ('casa', 'ritiro', 'spedizione') then
    raise exception 'Questo modo di consegna non è disponibile';
  end if;
  if p_modo in ('casa', 'spedizione') and char_length(btrim(coalesce(p_indirizzo, ''))) < 8 then
    raise exception 'Scrivi l''indirizzo completo';
  end if;
  if jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 or jsonb_array_length(p_righe) > 40 then
    raise exception 'Il cestino è vuoto';
  end if;
  -- freno contro gli scherzi: al massimo 5 ordini all'ora dallo stesso telefono alla stessa bottega
  select count(*) into recenti from public.ordini
   where bottega = p_bottega and regexp_replace(cliente_telefono, '\D', '', 'g') = regexp_replace(p_telefono, '\D', '', 'g')
     and creato > now() - interval '1 hour';
  if recenti >= 5 then raise exception 'Hai già mandato diversi ordini: aspetta la risposta del produttore'; end if;

  for r in select * from jsonb_array_elements(p_righe) loop
    q := (r->>'qta')::int;
    if q is null or q < 1 or q > 99 then raise exception 'Quantità non valida'; end if;
    select * into p from public.vetrina_prodotti where id = (r->>'id')::uuid and bottega = p_bottega;
    if p.id is null then raise exception 'Un prodotto non è più disponibile: ricarica la pagina'; end if;
    righe := righe || jsonb_build_object('id', p.id, 'nome', p.nome, 'unita', p.unita, 'prezzo', p.prezzo, 'qta', q);
    tot := tot + p.prezzo * q;
  end loop;

  insert into public.ordini (bottega, cliente_nome, cliente_telefono, cliente_email, modo, indirizzo, nota, righe, totale)
  values (p_bottega, btrim(p_nome), btrim(p_telefono), nullif(btrim(coalesce(p_email, '')), ''), p_modo,
          nullif(btrim(coalesce(p_indirizzo, '')), ''), nullif(btrim(coalesce(p_nota, '')), ''), righe, round(tot, 2))
  returning id, codice, totale into o;

  return json_build_object('id', o.id, 'codice', o.codice, 'totale', o.totale,
    'telefono', (select telefono from public.botteghe where id = p_bottega));
end $$;
revoke all on function public.ordina(uuid, jsonb, text, text, text, text, text, text) from public;
grant execute on function public.ordina(uuid, jsonb, text, text, text, text, text, text) to anon, authenticated;

-- ── foto: ognuno carica solo nella sua cartella, tutti le vedono ───────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('foto', 'foto', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "foto carico le mie" on storage.objects;
create policy "foto carico le mie" on storage.objects for insert to authenticated
  with check (bucket_id = 'foto' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "foto cambio le mie" on storage.objects;
create policy "foto cambio le mie" on storage.objects for update to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "foto cancello le mie" on storage.objects;
create policy "foto cancello le mie" on storage.objects for delete to authenticated
  using (bucket_id = 'foto' and (storage.foldername(name))[1] = auth.uid()::text);
