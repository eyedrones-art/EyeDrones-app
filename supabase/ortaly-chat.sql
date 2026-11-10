-- ORTALY — chat tra cliente e produttore, senza scambiarsi telefono ed email.
-- Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run. Si può rieseguire.
-- • il cliente ordina con nome e (se serve) indirizzo; il telefono non serve più
-- • ogni ordine ha un link segreto (ortaly.it/#ordine-...) da cui il cliente vede lo stato e scrive al produttore
-- • il produttore non vede né telefono né email del cliente: solo nome, indirizzo, nota e chat
-- • le notifiche possono portare un testo («Nuovo messaggio da Laura»): servono le chiavi del telefono

alter table public.ordini alter column cliente_telefono drop not null;
alter table public.ordini add column if not exists segreto text unique
  default replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
alter table public.notifiche add column if not exists p256dh text check (p256dh is null or char_length(p256dh) between 80 and 100);
alter table public.notifiche add column if not exists auth text check (auth is null or char_length(auth) between 16 and 30);
grant insert (bottega, endpoint, p256dh, auth) on public.notifiche to authenticated;

-- il produttore vede degli ordini solo quello che serve per prepararli
revoke select on public.ordini from authenticated;
grant select (id, codice, bottega, cliente_nome, modo, indirizzo, nota, righe, totale, stato, creato) on public.ordini to authenticated;

-- messaggi
create table if not exists public.messaggi (
  id uuid primary key default gen_random_uuid(),
  ordine uuid not null references public.ordini(id) on delete cascade,
  da text not null check (da in ('cliente', 'produttore')),
  testo text not null check (char_length(btrim(testo)) between 1 and 1000),
  letto boolean not null default false,
  avvisato boolean not null default false,
  creato timestamptz not null default now()
);
create index if not exists messaggi_ordine on public.messaggi(ordine, creato);

alter table public.messaggi enable row level security;
drop policy if exists "messaggi miei" on public.messaggi;
create policy "messaggi miei" on public.messaggi for select to authenticated
  using (ordine in (select o.id from public.ordini o join public.botteghe b on b.id = o.bottega where b.utente = auth.uid()));
drop policy if exists "scrivo ai miei clienti" on public.messaggi;
create policy "scrivo ai miei clienti" on public.messaggi for insert to authenticated
  with check (da = 'produttore' and ordine in (select o.id from public.ordini o join public.botteghe b on b.id = o.bottega where b.utente = auth.uid()));
drop policy if exists "segno letti" on public.messaggi;
create policy "segno letti" on public.messaggi for update to authenticated
  using (ordine in (select o.id from public.ordini o join public.botteghe b on b.id = o.bottega where b.utente = auth.uid()));
revoke all on public.messaggi from anon, authenticated;
grant select (id, ordine, da, testo, letto, creato) on public.messaggi to authenticated;
grant insert (ordine, da, testo) on public.messaggi to authenticated;
grant update (letto) on public.messaggi to authenticated;

-- ordine del cliente, senza telefono; il cliente riceve il link segreto del suo ordine
drop function if exists public.ordina(uuid, jsonb, text, text, text, text, text, text);
create or replace function public.ordina(p_bottega uuid, p_righe jsonb, p_nome text, p_email text, p_modo text, p_indirizzo text, p_nota text)
returns json language plpgsql security definer set search_path = public as $$
declare b record; r jsonb; p record; righe jsonb := '[]'::jsonb; tot numeric := 0; q int; o record; recenti int;
begin
  select * into b from public.vetrina_botteghe where id = p_bottega;
  if b.id is null then raise exception 'Questa bottega non riceve ordini in questo momento'; end if;
  if (p_modo = 'casa' and b.consegna_casa is null) or (p_modo = 'ritiro' and b.ritiro is null) or (p_modo = 'spedizione' and b.spedizione is null) or p_modo not in ('casa', 'ritiro', 'spedizione') then
    raise exception 'Questo modo di consegna non è disponibile'; end if;
  if p_modo in ('casa', 'spedizione') and char_length(btrim(coalesce(p_indirizzo, ''))) < 8 then raise exception 'Scrivi l''indirizzo completo'; end if;
  if jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 or jsonb_array_length(p_righe) > 40 then raise exception 'Il cestino è vuoto'; end if;
  -- freno contro gli scherzi: stesso nome alla stessa bottega al massimo 5 volte all'ora, e al massimo 60 ordini all'ora per bottega
  select count(*) filter (where lower(btrim(cliente_nome)) = lower(btrim(p_nome))), count(*) into recenti, q
    from public.ordini where bottega = p_bottega and creato > now() - interval '1 hour';
  if recenti >= 5 or q >= 60 then raise exception 'Hai già mandato diversi ordini: aspetta la risposta del produttore'; end if;
  for r in select * from jsonb_array_elements(p_righe) loop
    q := (r->>'qta')::int;
    if q is null or q < 1 or q > 99 then raise exception 'Quantità non valida'; end if;
    select * into p from public.vetrina_prodotti where id = (r->>'id')::uuid and bottega = p_bottega;
    if p.id is null then raise exception 'Un prodotto non è più disponibile: ricarica la pagina'; end if;
    righe := righe || jsonb_build_object('id', p.id, 'nome', p.nome, 'unita', p.unita, 'prezzo', p.prezzo, 'qta', q);
    tot := tot + p.prezzo * q;
  end loop;
  insert into public.ordini (bottega, cliente_nome, cliente_email, modo, indirizzo, nota, righe, totale)
  values (p_bottega, btrim(p_nome), nullif(btrim(coalesce(p_email, '')), ''), p_modo,
          nullif(btrim(coalesce(p_indirizzo, '')), ''), nullif(btrim(coalesce(p_nota, '')), ''), righe, round(tot, 2))
  returning id, codice, totale, segreto into o;
  return json_build_object('id', o.id, 'codice', o.codice, 'totale', o.totale, 'segreto', o.segreto);
end $$;
revoke all on function public.ordina(uuid, jsonb, text, text, text, text, text) from public;
grant execute on function public.ordina(uuid, jsonb, text, text, text, text, text) to anon, authenticated;

-- il cliente apre il suo ordine con il link segreto
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
                          from public.messaggi m where m.ordine = o.id), '[]'::json));
end $$;
revoke all on function public.ordine_cliente(text) from public;
grant execute on function public.ordine_cliente(text) to anon, authenticated;

-- il cliente scrive al produttore
create or replace function public.scrivi_cliente(p_segreto text, p_testo text)
returns json language plpgsql security definer set search_path = public as $$
declare o record; n int; m record;
begin
  if p_segreto is null or p_segreto !~ '^[0-9a-f]{64}$' then raise exception 'Ordine non trovato'; end if;
  select id, creato into o from public.ordini where segreto = p_segreto;
  if o.id is null then raise exception 'Ordine non trovato'; end if;
  if o.creato < now() - interval '90 days' then raise exception 'Questo ordine è troppo vecchio per scrivere'; end if;
  if char_length(btrim(coalesce(p_testo, ''))) not between 1 and 1000 then raise exception 'Scrivi un messaggio (al massimo 1000 caratteri)'; end if;
  select count(*) into n from public.messaggi where ordine = o.id and da = 'cliente' and creato > now() - interval '1 hour';
  if n >= 20 then raise exception 'Hai mandato molti messaggi: aspetta la risposta del produttore'; end if;
  insert into public.messaggi (ordine, da, testo) values (o.id, 'cliente', btrim(p_testo)) returning id, creato into m;
  return json_build_object('id', m.id, 'creato', m.creato);
end $$;
revoke all on function public.scrivi_cliente(text, text) from public;
grant execute on function public.scrivi_cliente(text, text) to anon, authenticated;

-- i vecchi telefoni dei clienti non servono più: li cancello
update public.ordini set cliente_telefono = null where cliente_telefono is not null;
