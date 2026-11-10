-- ORTALY — valutazioni pubbliche (stelle e commento, dopo la consegna) e segnalazioni private («qualcosa non è andato bene»).
-- Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run, DOPO ortaly-chat.sql. Si può rieseguire.
-- • la valutazione si dà una volta per ordine consegnato (si può correggere per 14 giorni); è pubblica con nome e iniziale
-- • il produttore può rispondere pubblicamente; Ortaly può nascondere una valutazione (colonna nascosta, da Table Editor)
-- • contro i voti falsi: solo ordini consegnati (lo segna il produttore), una valutazione per cliente per bottega,
--   nessuna valutazione da chi ha una bottega su Ortaly; il produttore può segnalare a Ortaly una valutazione sospetta
-- • la segnalazione è privata: la vedono il produttore (nel suo ordine) e Ortaly (email a info@ortaly.it)

create table if not exists public.recensioni (
  id uuid primary key default gen_random_uuid(),
  ordine uuid not null unique references public.ordini(id) on delete cascade,
  bottega uuid not null references public.botteghe(id) on delete cascade,
  stelle int not null check (stelle between 1 and 5),
  commento text check (char_length(commento) <= 500),
  nome text not null check (char_length(nome) between 1 and 40),
  risposta text check (char_length(risposta) <= 500),
  nascosta boolean not null default false,
  avvisato boolean not null default false,
  creata timestamptz not null default now()
);
create index if not exists recensioni_bottega on public.recensioni(bottega, creata desc);
alter table public.recensioni add column if not exists contestata boolean not null default false;
alter table public.recensioni add column if not exists contestata_avvisata boolean not null default false;

create table if not exists public.segnalazioni (
  id uuid primary key default gen_random_uuid(),
  ordine uuid not null references public.ordini(id) on delete cascade,
  tipo text not null check (tipo in ('mancava', 'qualita', 'ritardo', 'quantita', 'altro')),
  testo text not null check (char_length(btrim(testo)) between 3 and 1000),
  risolta boolean not null default false,
  avvisato boolean not null default false,
  creata timestamptz not null default now()
);
create index if not exists segnalazioni_ordine on public.segnalazioni(ordine);

alter table public.recensioni enable row level security;
alter table public.segnalazioni enable row level security;
drop policy if exists "recensioni mie" on public.recensioni;
create policy "recensioni mie" on public.recensioni for select to authenticated
  using (bottega in (select id from public.botteghe where utente = auth.uid()));
drop policy if exists "rispondo alle recensioni" on public.recensioni;
create policy "rispondo alle recensioni" on public.recensioni for update to authenticated
  using (bottega in (select id from public.botteghe where utente = auth.uid()));
drop policy if exists "segnalazioni mie" on public.segnalazioni;
create policy "segnalazioni mie" on public.segnalazioni for select to authenticated
  using (ordine in (select o.id from public.ordini o join public.botteghe b on b.id = o.bottega where b.utente = auth.uid()));
drop policy if exists "risolvo segnalazioni" on public.segnalazioni;
create policy "risolvo segnalazioni" on public.segnalazioni for update to authenticated
  using (ordine in (select o.id from public.ordini o join public.botteghe b on b.id = o.bottega where b.utente = auth.uid()));
revoke all on public.recensioni, public.segnalazioni from anon, authenticated;
grant select (id, ordine, bottega, stelle, commento, nome, risposta, nascosta, contestata, creata) on public.recensioni to authenticated;
grant update (risposta, contestata) on public.recensioni to authenticated;
grant select (id, ordine, tipo, testo, risolta, creata) on public.segnalazioni to authenticated;
grant update (risolta) on public.segnalazioni to authenticated;

-- vetrina pubblica: valutazioni visibili e media per bottega
create or replace view public.vetrina_recensioni with (security_invoker = false) as
  select r.id, r.bottega, r.stelle, r.commento, r.nome, r.risposta, r.creata
  from public.recensioni r join public.vetrina_botteghe b on b.id = r.bottega
  where not r.nascosta;
create or replace view public.vetrina_stelle with (security_invoker = false) as
  select bottega, round(avg(stelle)::numeric, 1) as media, count(*) as numero
  from public.vetrina_recensioni group by bottega;
grant select on public.vetrina_recensioni, public.vetrina_stelle to anon, authenticated;

-- il cliente valuta il suo ordine consegnato (con il link segreto); nome pubblico: nome e iniziale del cognome
create or replace function public.valuta_ordine(p_segreto text, p_stelle int, p_commento text)
returns json language plpgsql security definer set search_path = public as $$
declare o record; r record; parti text[]; pubblico text;
begin
  if p_segreto is null or p_segreto !~ '^[0-9a-f]{64}$' then raise exception 'Ordine non trovato'; end if;
  select id, bottega, stato, cliente_nome, cliente_email into o from public.ordini where segreto = p_segreto;
  if o.id is null then raise exception 'Ordine non trovato'; end if;
  if exists (select 1 from public.botteghe bb join auth.users u on u.id = bb.utente where lower(u.email) = lower(btrim(o.cliente_email))) then
    raise exception 'Chi ha una bottega su Ortaly non può lasciare valutazioni'; end if;
  if exists (select 1 from public.recensioni x join public.ordini y on y.id = x.ordine
             where x.bottega = o.bottega and x.ordine <> o.id and lower(y.cliente_email) = lower(btrim(o.cliente_email))) then
    raise exception 'Hai già valutato questa bottega: puoi correggere la valutazione che hai già dato'; end if;
  if o.stato <> 'consegnato' then raise exception 'Puoi valutare l''ordine dopo la consegna'; end if;
  if p_stelle is null or p_stelle not between 1 and 5 then raise exception 'Scegli da 1 a 5 stelle'; end if;
  if char_length(coalesce(p_commento, '')) > 500 then raise exception 'Il commento è troppo lungo (al massimo 500 caratteri)'; end if;
  select * into r from public.recensioni where ordine = o.id;
  if r.id is not null and r.creata < now() - interval '14 days' then raise exception 'Puoi correggere la valutazione solo nei primi 14 giorni'; end if;
  parti := regexp_split_to_array(btrim(o.cliente_nome), '\s+');
  pubblico := left(parti[1], 30) || case when array_length(parti, 1) > 1 then ' ' || upper(left(parti[array_length(parti, 1)], 1)) || '.' else '' end;
  insert into public.recensioni (ordine, bottega, stelle, commento, nome)
  values (o.id, o.bottega, p_stelle, nullif(btrim(coalesce(p_commento, '')), ''), pubblico)
  on conflict (ordine) do update set stelle = excluded.stelle, commento = excluded.commento
  returning id into r;
  return json_build_object('id', r.id);
end $$;
revoke all on function public.valuta_ordine(text, int, text) from public;
grant execute on function public.valuta_ordine(text, int, text) to anon, authenticated;

-- il cliente segnala un problema (privato), al massimo 3 per ordine
create or replace function public.segnala_problema(p_segreto text, p_tipo text, p_testo text)
returns json language plpgsql security definer set search_path = public as $$
declare o record; n int; s record;
begin
  if p_segreto is null or p_segreto !~ '^[0-9a-f]{64}$' then raise exception 'Ordine non trovato'; end if;
  select id, creato into o from public.ordini where segreto = p_segreto;
  if o.id is null then raise exception 'Ordine non trovato'; end if;
  if o.creato < now() - interval '60 days' then raise exception 'L''ordine è troppo vecchio: scrivi a info@ortaly.it'; end if;
  if p_tipo not in ('mancava', 'qualita', 'ritardo', 'quantita', 'altro') then raise exception 'Scegli cosa non è andato'; end if;
  if char_length(btrim(coalesce(p_testo, ''))) not between 3 and 1000 then raise exception 'Racconta in poche parole cosa è successo'; end if;
  select count(*) into n from public.segnalazioni where ordine = o.id;
  if n >= 3 then raise exception 'Hai già mandato diverse segnalazioni: scrivi a info@ortaly.it'; end if;
  insert into public.segnalazioni (ordine, tipo, testo) values (o.id, p_tipo, btrim(p_testo)) returning id into s;
  return json_build_object('id', s.id);
end $$;
revoke all on function public.segnala_problema(text, text, text) from public;
grant execute on function public.segnala_problema(text, text, text) to anon, authenticated;

-- la pagina dell'ordine del cliente mostra anche la sua valutazione e le sue segnalazioni
create or replace function public.ordine_cliente(p_segreto text)
returns json language plpgsql stable security definer set search_path = public as $$
declare o record; b record;
begin
  if p_segreto is null or p_segreto !~ '^[0-9a-f]{64}$' then raise exception 'Ordine non trovato'; end if;
  select * into o from public.ordini where segreto = p_segreto;
  if o.id is null then raise exception 'Ordine non trovato'; end if;
  select nome, paese, provincia, consegna_casa, ritiro, spedizione into b from public.botteghe where id = o.bottega;
  return json_build_object('codice', o.codice, 'stato', o.stato, 'righe', o.righe, 'totale', o.totale, 'modo', o.modo,
    'indirizzo', o.indirizzo, 'nota', o.nota, 'creato', o.creato, 'cliente', o.cliente_nome,
    'bottega', json_build_object('id', o.bottega, 'nome', b.nome, 'paese', b.paese, 'provincia', b.provincia,
      'consegna_casa', b.consegna_casa, 'ritiro', b.ritiro, 'spedizione', b.spedizione),
    'messaggi', coalesce((select json_agg(json_build_object('id', m.id, 'da', m.da, 'testo', m.testo, 'creato', m.creato) order by m.creato)
                          from public.messaggi m where m.ordine = o.id), '[]'::json),
    'recensione', (select json_build_object('stelle', r.stelle, 'commento', r.commento, 'risposta', r.risposta, 'creata', r.creata)
                   from public.recensioni r where r.ordine = o.id),
    'segnalazioni', coalesce((select json_agg(json_build_object('tipo', s.tipo, 'testo', s.testo, 'risolta', s.risolta, 'creata', s.creata) order by s.creata)
                              from public.segnalazioni s where s.ordine = o.id), '[]'::json));
end $$;
