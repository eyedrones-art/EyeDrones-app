-- ORTALY — spedizione con corriere: il produttore scrive corriere e numero di spedizione quando spedisce;
-- il cliente lo vede nella pagina dell'ordine (con il link per seguire il pacco) e lo riceve per notifica ed email.
-- Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run, DOPO ortaly-spese.sql. Si può rieseguire.
alter table public.ordini add column if not exists corriere text check (corriere is null or corriere in ('BRT', 'GLS', 'SDA', 'Poste Italiane', 'DHL', 'UPS', 'TNT/FedEx', 'Nexive', 'Altro'));
alter table public.ordini add column if not exists tracking text check (tracking is null or tracking ~ '^[A-Za-z0-9][A-Za-z0-9 ./-]{3,59}$');
grant select (corriere, tracking) on public.ordini to authenticated;
grant update (corriere, tracking) on public.ordini to authenticated;

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
    'annullato_da', o.annullato_da, 'motivo_annullo', o.motivo_annullo, 'pagamento', o.pagamento, 'pagato', o.pagato, 'spese', o.spese, 'rimborsato', o.rimborsato, 'corriere', o.corriere, 'tracking', o.tracking,
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
