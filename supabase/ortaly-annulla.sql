-- ORTALY — il cliente può annullare il suo ordine finché il produttore non l'ha preparato (stato «nuovo» o «accettato»).
-- Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run, DOPO ortaly-recensioni.sql. Si può rieseguire.
alter table public.ordini add column if not exists annullato_da text check (annullato_da is null or annullato_da in ('cliente', 'produttore'));
alter table public.ordini add column if not exists motivo_annullo text check (motivo_annullo is null or char_length(motivo_annullo) <= 300);
grant select (annullato_da, motivo_annullo) on public.ordini to authenticated;

create or replace function public.annulla_ordine(p_segreto text, p_motivo text)
returns json language plpgsql security definer set search_path = public as $$
declare o record;
begin
  if p_segreto is null or p_segreto !~ '^[0-9a-f]{64}$' then raise exception 'Ordine non trovato'; end if;
  select id, stato into o from public.ordini where segreto = p_segreto for update;
  if o.id is null then raise exception 'Ordine non trovato'; end if;
  if o.stato = 'annullato' then raise exception 'L''ordine è già annullato'; end if;
  if o.stato not in ('nuovo', 'accettato') then raise exception 'Il produttore ha già preparato l''ordine: scrivigli nella chat'; end if;
  if char_length(coalesce(p_motivo, '')) > 300 then raise exception 'Il motivo è troppo lungo (al massimo 300 caratteri)'; end if;
  update public.ordini set stato = 'annullato', annullato_da = 'cliente', motivo_annullo = nullif(btrim(coalesce(p_motivo, '')), '') where id = o.id;
  return json_build_object('id', o.id);
end $$;
revoke all on function public.annulla_ordine(text, text) from public;
grant execute on function public.annulla_ordine(text, text) to anon, authenticated;

-- la pagina dell'ordine del cliente dice anche chi ha annullato
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
    'annullato_da', o.annullato_da, 'motivo_annullo', o.motivo_annullo,
    'bottega', json_build_object('id', o.bottega, 'nome', b.nome, 'paese', b.paese, 'provincia', b.provincia,
      'consegna_casa', b.consegna_casa, 'ritiro', b.ritiro, 'spedizione', b.spedizione),
    'messaggi', coalesce((select json_agg(json_build_object('id', m.id, 'da', m.da, 'testo', m.testo, 'creato', m.creato) order by m.creato)
                          from public.messaggi m where m.ordine = o.id), '[]'::json),
    'recensione', (select json_build_object('stelle', r.stelle, 'commento', r.commento, 'risposta', r.risposta, 'creata', r.creata)
                   from public.recensioni r where r.ordine = o.id),
    'segnalazioni', coalesce((select json_agg(json_build_object('tipo', s.tipo, 'testo', s.testo, 'risolta', s.risolta, 'creata', s.creata) order by s.creata)
                              from public.segnalazioni s where s.ordine = o.id), '[]'::json));
end $$;
