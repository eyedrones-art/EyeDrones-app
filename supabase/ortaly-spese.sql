-- ORTALY — costi di consegna/spedizione nel totale, pagamento solo dopo l'accettazione, rimborso degli ordini pagati e annullati.
-- • la bottega indica costo e «gratis sopra» per consegna a casa e spedizione; il totale li comprende (li calcola il database)
-- • il link per pagare compare al cliente solo quando il produttore ha accettato l'ordine
-- • se un ordine pagato viene annullato, il produttore lo vede finché non segna «Rimborsato»
-- Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run, DOPO ortaly-pagamenti.sql. Si può rieseguire.
alter table public.botteghe add column if not exists costo_casa numeric(6,2) check (costo_casa is null or (costo_casa >= 0 and costo_casa < 100));
alter table public.botteghe add column if not exists gratis_casa numeric(8,2) check (gratis_casa is null or (gratis_casa > 0 and gratis_casa < 10000));
alter table public.botteghe add column if not exists costo_spedizione numeric(6,2) check (costo_spedizione is null or (costo_spedizione >= 0 and costo_spedizione < 100));
alter table public.botteghe add column if not exists gratis_spedizione numeric(8,2) check (gratis_spedizione is null or (gratis_spedizione > 0 and gratis_spedizione < 10000));
grant update (costo_casa, gratis_casa, costo_spedizione, gratis_spedizione) on public.botteghe to authenticated;

alter table public.ordini add column if not exists spese numeric(6,2) not null default 0;
alter table public.ordini add column if not exists rimborsato boolean not null default false;
grant select (spese, rimborsato) on public.ordini to authenticated;
grant update (rimborsato) on public.ordini to authenticated;

create or replace view public.vetrina_botteghe with (security_invoker = false) as
  select id, nome, paese, provincia, tipo, storia, foto, consegna_casa, ritiro, spedizione, bio, creata, pagamento,
         costo_casa, gratis_casa, costo_spedizione, gratis_spedizione
  from public.botteghe
  where visibile and (abbonamento = 'attivo' or (abbonamento = 'prova' and prova_fino >= current_date));

create or replace function public.ordina(p_bottega uuid, p_righe jsonb, p_nome text, p_email text, p_modo text, p_indirizzo text, p_nota text, p_novita boolean default false, p_pagamento text default 'consegna')
returns json language plpgsql security definer set search_path = public as $$
declare b record; r jsonb; p record; righe jsonb := '[]'::jsonb; tot numeric := 0; q int; o record; recenti int; mancati int; botteghe_mancati int; pag text; bt record; spese numeric := 0;
begin
  select * into b from public.vetrina_botteghe where id = p_bottega;
  if b.id is null then raise exception 'Questa bottega non riceve ordini in questo momento'; end if;
  if (p_modo = 'casa' and b.consegna_casa is null) or (p_modo = 'ritiro' and b.ritiro is null) or (p_modo = 'spedizione' and b.spedizione is null) or p_modo not in ('casa', 'ritiro', 'spedizione') then
    raise exception 'Questo modo di consegna non è disponibile'; end if;
  if p_modo in ('casa', 'spedizione') and char_length(btrim(coalesce(p_indirizzo, ''))) < 8 then raise exception 'Scrivi l''indirizzo completo'; end if;
  if jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) = 0 or jsonb_array_length(p_righe) > 40 then raise exception 'Il cestino è vuoto'; end if;
  if coalesce(btrim(p_email), '') !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(btrim(p_email)) > 120 then raise exception 'Scrivi la tua email: ti avvisiamo lì quando il produttore risponde'; end if;
  -- chi non ha ritirato più ordini (2 di botteghe diverse o 3 in tutto, nell'ultimo anno) non può più ordinare
  select count(*), count(distinct bottega) into mancati, botteghe_mancati from public.ordini
   where stato = 'non_ritirato' and lower(cliente_email) = lower(btrim(p_email)) and creato > now() - interval '12 months';
  if mancati >= 3 or (mancati >= 2 and botteghe_mancati >= 2) then
    raise exception 'Non puoi ordinare: risultano ordini non ritirati. Se è un errore scrivi a info@ortaly.it'; end if;
  -- freno contro gli scherzi: stesso nome alla stessa bottega al massimo 5 volte all'ora, e al massimo 60 ordini all'ora per bottega
  -- come si paga: lo decide la bottega; se offre tutte e due sceglie il cliente, ma chi non ha ritirato un ordine paga online
  pag := case when b.pagamento = 'online' then 'online' when b.pagamento = 'consegna' then 'consegna'
              when mancati >= 1 or p_pagamento = 'online' then 'online' else 'consegna' end;
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
  -- spese di consegna o spedizione, calcolate qui (non dal telefono)
  select costo_casa, gratis_casa, costo_spedizione, gratis_spedizione into bt from public.botteghe where id = p_bottega;
  spese := case p_modo
    when 'casa' then case when bt.gratis_casa is not null and tot >= bt.gratis_casa then 0 else coalesce(bt.costo_casa, 0) end
    when 'spedizione' then case when bt.gratis_spedizione is not null and tot >= bt.gratis_spedizione then 0 else coalesce(bt.costo_spedizione, 0) end
    else 0 end;
  insert into public.ordini (bottega, cliente_nome, cliente_email, modo, indirizzo, nota, righe, totale, mancati_precedenti, pagamento, spese)
  values (p_bottega, btrim(p_nome), nullif(btrim(coalesce(p_email, '')), ''), p_modo,
          nullif(btrim(coalesce(p_indirizzo, '')), ''), nullif(btrim(coalesce(p_nota, '')), ''), righe, round(tot + spese, 2), mancati, pag, spese)
  returning id, codice, totale, segreto into o;
  if p_novita then
    insert into public.novita (email, provincia) values (lower(btrim(p_email)), b.provincia)
    on conflict (email) do update set disiscritto = null, consenso = now(), provincia = excluded.provincia;
  end if;
  return json_build_object('id', o.id, 'codice', o.codice, 'totale', o.totale, 'segreto', o.segreto, 'pagamento', pag, 'spese', spese);
end $$;
revoke all on function public.ordina(uuid, jsonb, text, text, text, text, text, boolean, text) from public;
grant execute on function public.ordina(uuid, jsonb, text, text, text, text, text, boolean, text) to anon, authenticated;


create or replace function public.ordine_cliente(p_segreto text)
returns json language plpgsql stable security definer set search_path = public as $$
declare o record; b record;
begin
  if p_segreto is null or p_segreto !~ '^[0-9a-f]{64}$' then raise exception 'Ordine non trovato'; end if;
  select * into o from public.ordini where segreto = p_segreto;
  if o.id is null then raise exception 'Ordine non trovato'; end if;
  select nome, paese, provincia, consegna_casa, ritiro, spedizione, link_pagamento into b from public.botteghe where id = o.bottega;
  return json_build_object('codice', o.codice, 'stato', o.stato, 'righe', o.righe, 'totale', o.totale, 'modo', o.modo,
    'indirizzo', o.indirizzo, 'nota', o.nota, 'creato', o.creato, 'cliente', o.cliente_nome,
    'annullato_da', o.annullato_da, 'motivo_annullo', o.motivo_annullo, 'pagamento', o.pagamento, 'pagato', o.pagato, 'spese', o.spese, 'rimborsato', o.rimborsato,
    'bottega', json_build_object('id', o.bottega, 'nome', b.nome, 'paese', b.paese, 'provincia', b.provincia,
      'consegna_casa', b.consegna_casa, 'ritiro', b.ritiro, 'spedizione', b.spedizione,
      'link_pagamento', case when o.pagamento = 'online' and o.stato in ('accettato', 'pronto', 'consegnato') then b.link_pagamento end),
    'messaggi', coalesce((select json_agg(json_build_object('id', m.id, 'da', m.da, 'testo', m.testo, 'creato', m.creato) order by m.creato)
                          from public.messaggi m where m.ordine = o.id), '[]'::json),
    'recensione', (select json_build_object('stelle', r.stelle, 'commento', r.commento, 'risposta', r.risposta, 'creata', r.creata)
                   from public.recensioni r where r.ordine = o.id),
    'segnalazioni', coalesce((select json_agg(json_build_object('tipo', s.tipo, 'testo', s.testo, 'risolta', s.risolta, 'creata', s.creata) order by s.creata)
                              from public.segnalazioni s where s.ordine = o.id), '[]'::json));
end $$;
