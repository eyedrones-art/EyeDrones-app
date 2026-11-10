-- ORTALY — «Non si è presentato»: il produttore segna un ordine non ritirato.
-- • chi ha 2 ordini non ritirati da botteghe diverse (o 3 in tutto) nell'ultimo anno non può più ordinare
-- • sui nuovi ordini il produttore vede quanti ordini quel cliente non ha ritirato in passato (senza vedere l'email)
-- • se il produttore ha sbagliato, può rimettere l'ordine come consegnato; il cliente viene avvisato e può scrivere a info@ortaly.it
-- Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run, DOPO ortaly-annulla.sql. Si può rieseguire.
alter table public.ordini drop constraint if exists ordini_stato_check;
alter table public.ordini add constraint ordini_stato_check check (stato in ('nuovo', 'accettato', 'pronto', 'consegnato', 'annullato', 'non_ritirato'));
alter table public.ordini add column if not exists mancati_precedenti int not null default 0;
grant select (mancati_precedenti) on public.ordini to authenticated;
create index if not exists ordini_email_stato on public.ordini (lower(cliente_email), stato);

create or replace function public.ordina(p_bottega uuid, p_righe jsonb, p_nome text, p_email text, p_modo text, p_indirizzo text, p_nota text, p_novita boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare b record; r jsonb; p record; righe jsonb := '[]'::jsonb; tot numeric := 0; q int; o record; recenti int; mancati int; botteghe_mancati int;
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
  insert into public.ordini (bottega, cliente_nome, cliente_email, modo, indirizzo, nota, righe, totale, mancati_precedenti)
  values (p_bottega, btrim(p_nome), nullif(btrim(coalesce(p_email, '')), ''), p_modo,
          nullif(btrim(coalesce(p_indirizzo, '')), ''), nullif(btrim(coalesce(p_nota, '')), ''), righe, round(tot, 2), mancati)
  returning id, codice, totale, segreto into o;
  if p_novita then
    insert into public.novita (email, provincia) values (lower(btrim(p_email)), b.provincia)
    on conflict (email) do update set disiscritto = null, consenso = now(), provincia = excluded.provincia;
  end if;
  return json_build_object('id', o.id, 'codice', o.codice, 'totale', o.totale, 'segreto', o.segreto);
end $$;
revoke all on function public.ordina(uuid, jsonb, text, text, text, text, text, boolean) from public;
grant execute on function public.ordina(uuid, jsonb, text, text, text, text, text, boolean) to anon, authenticated;
