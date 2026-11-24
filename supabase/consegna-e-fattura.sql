-- EyeDrones — «Trova un pilota»: il lavoro si paga prima di riceverlo, e la fattura
--
-- 1) Con il «Pagamento protetto» acceso (pagamento-protetto.sql) e il pilota con il conto Stripe collegato, il cliente
--    vede il lavoro consegnato (link a foto, video o report) solo dopo aver pagato tutto il prezzo. Prima vede
--    «il tuo lavoro è pronto: paga per vederlo». Così il caso «il cliente non paga» non esiste più: i soldi sono già
--    fermi su Stripe quando riceve il lavoro. Con il pagamento protetto spento non cambia niente.
-- 2) La fattura: il cliente che ne ha bisogno scrive i dati (ragione sociale, P.IVA o codice fiscale, SDI o PEC,
--    indirizzo). Li vede solo il pilota che ha confermato il lavoro: è lui a fare la fattura per il suo prezzo.
--    Nelle offerte il cliente vede già chi emette fattura (regime fiscale del pilota: forfettario o ordinario).
--
-- Richiede pagamento-protetto.sql. Da eseguire una volta: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi.

-- il lavoro è da pagare prima di vederlo? (pagamento protetto acceso, pilota pronto a ricevere, prezzo non pagato tutto)
create or replace function privato.consegna_bloccata(p_offerta uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare o public.offerte_zona; v_pagato numeric;
begin
  if not coalesce((privato.protezione_conf() ->> 'attivo')::boolean, false) then return false; end if;
  select * into o from public.offerte_zona where id = p_offerta;
  if not found then return false; end if;
  if not coalesce((select pronto from privato.piloti_stripe where user_id = o.user_id), false) then return false; end if;
  select coalesce(sum(importo_pilota), 0) into v_pagato from public.pagamenti_protetti
    where offerta_id = o.id and stato in ('pagato', 'rilasciato');
  return v_pagato < o.prezzo;
end $$;
revoke all on function privato.consegna_bloccata(uuid) from public, anon, authenticated;

-- i dati per la fattura del cliente (uno per richiesta)
create table if not exists privato.fatture_clienti (
  richiesta_id uuid primary key references public.richieste_zona(id) on delete cascade,
  dati jsonb not null,
  aggiornato timestamptz not null default now()
);
revoke all on privato.fatture_clienti from public, anon, authenticated;

create or replace function privato.fattura_di(p_richiesta uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select dati from privato.fatture_clienti where richiesta_id = p_richiesta;
$$;
revoke all on function privato.fattura_di(uuid) from public, anon, authenticated;

-- il cliente (con il suo link) salva o cancella i dati per la fattura
create or replace function public.salva_fattura_cliente(p_codice text, p_dati jsonb)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid; v_pilota uuid; d jsonb; v_t text;
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then raise exception 'richiesta non trovata'; end if;
  select id into v_id from public.richieste_zona where codice = p_codice;
  if v_id is null then raise exception 'richiesta non trovata'; end if;
  if p_dati is null then delete from privato.fatture_clienti where richiesta_id = v_id; return true; end if;
  d := jsonb_strip_nulls(jsonb_build_object(
    'intestazione', nullif(left(btrim(coalesce(p_dati ->> 'intestazione', '')), 120), ''),
    'piva_cf', nullif(upper(left(regexp_replace(coalesce(p_dati ->> 'piva_cf', ''), '\s', '', 'g'), 20)), ''),
    'sdi_pec', nullif(left(btrim(coalesce(p_dati ->> 'sdi_pec', '')), 120), ''),
    'indirizzo', nullif(left(btrim(coalesce(p_dati ->> 'indirizzo', '')), 200), '')));
  if d ->> 'intestazione' is null or d ->> 'piva_cf' is null then raise exception 'mancano intestazione o P.IVA / codice fiscale'; end if;
  insert into privato.fatture_clienti (richiesta_id, dati) values (v_id, d)
  on conflict (richiesta_id) do update set dati = excluded.dati, aggiornato = now();
  -- lavoro già confermato: avviso il pilota che ha i dati per la fattura
  select o.user_id into v_pilota from public.offerte_zona o where o.richiesta_id = v_id and o.stato = 'confermata' limit 1;
  if v_pilota is not null then
    select servizio into v_t from public.richieste_zona where id = v_id;
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'fattura_dati', 'a', privato.pilota_contatto(v_pilota) ->> 'email',
      'servizio', v_t, 'fattura', d));
  end if;
  return true;
end $$;
revoke all on function public.salva_fattura_cliente(text, jsonb) from public;
grant execute on function public.salva_fattura_cliente(text, jsonb) to anon, authenticated;

-- per il pilota: i dati per la fattura dei suoi lavori confermati (id richiesta → dati)
create or replace function public.fatture_pilota()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(o.richiesta_id, f.dati), '{}'::jsonb)
  from public.offerte_zona o join privato.fatture_clienti f on f.richiesta_id = o.richiesta_id
  where o.user_id = auth.uid() and o.stato = 'confermata';
$$;
revoke all on function public.fatture_pilota() from public;
grant execute on function public.fatture_pilota() to authenticated;

-- il riquadro del pagamento protetto sa se il lavoro è consegnato ma da pagare
create or replace function public.protezione_cliente(p_codice text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_off uuid; s jsonb; v_cons boolean;
begin
  if not (privato.protezione_conf() ->> 'attivo')::boolean then return null; end if;
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then return null; end if;
  select o.id, o.consegna is not null into v_off, v_cons from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
    where z.codice = p_codice and o.stato = 'confermata' limit 1;
  if v_off is null then return null; end if;
  s := privato.protezione_stato(v_off);
  if not (s ->> 'pronto')::boolean and (s ->> 'pagato')::numeric = 0 then return null; end if;
  return s || jsonb_build_object('offerta', v_off, 'consegnato', v_cons, 'bloccata', v_cons and privato.consegna_bloccata(v_off));
end $$;
revoke all on function public.protezione_cliente(text) from public;
grant execute on function public.protezione_cliente(text) to anon, authenticated;

-- pagato tutto dopo la consegna: mando al cliente l'email con il link al lavoro
create or replace function privato.consegna_dopo_pagamento()
returns trigger language plpgsql security definer set search_path = public as $$
declare o public.offerte_zona; z public.richieste_zona; v_prima numeric;
begin
  select * into o from public.offerte_zona where id = new.offerta_id;
  if o.consegna is null or o.stato <> 'confermata' or privato.consegna_bloccata(o.id) then return new; end if;
  -- era bloccata prima di questo pagamento?
  select coalesce(sum(importo_pilota), 0) into v_prima from public.pagamenti_protetti
    where offerta_id = o.id and stato in ('pagato', 'rilasciato') and id <> new.id;
  if v_prima >= o.prezzo then return new; end if;
  select * into z from public.richieste_zona where id = o.richiesta_id;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'consegnato', 'a', z.email, 'nome', z.nome, 'codice', z.codice,
    'pilota', privato.pilota_contatto(o.user_id) ->> 'nome', 'servizio', z.servizio, 'link', o.consegna ->> 'link',
    'nota', o.consegna ->> 'nota'));
  return new;
end $$;
revoke all on function privato.consegna_dopo_pagamento() from public, anon, authenticated;
drop trigger if exists consegna_dopo_pagamento on public.pagamenti_protetti;
create trigger consegna_dopo_pagamento after insert on public.pagamenti_protetti
  for each row execute function privato.consegna_dopo_pagamento();

-- la pagina del cliente (stessa di trova-pilota.sql) con la consegna nascosta finché non è pagata e i dati per la fattura
create or replace function public.offerte_cliente(p_codice text)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare v_z public.richieste_zona;
begin
  perform privato.scadi_scelte();
  select * into v_z from public.richieste_zona where codice = p_codice;
  if not found then return null; end if;
  return json_build_object(
    'richiesta', json_build_object('fattura', privato.fattura_di(v_z.id), 'nome', v_z.nome, 'provincia', v_z.provincia, 'servizio', v_z.servizio, 'luogo', v_z.luogo,
      'data_desiderata', v_z.data_desiderata, 'descrizione', v_z.descrizione, 'stato', v_z.stato, 'scelta_il', v_z.scelta_il,
      'created_at', v_z.created_at, 'budget', v_z.budget, 'diretta', v_z.pilota_diretto is not null),
    'offerte', coalesce((
      select json_agg(json_build_object(
        'id', o.id, 'prezzo', o.prezzo, 'dettagli', o.dettagli,
        'messaggio', case when o.stato = 'confermata' then o.messaggio else privato.senza_nome(privato.senza_contatti(o.messaggio), coalesce(nullif(g.nome, ''), p.azienda_nome)) end,
        'stato', o.stato, 'created_at', o.created_at,
        -- a lavoro confermato: la consegna e le stelle date dal cliente
        'consegna', case when o.stato = 'confermata' and not privato.consegna_bloccata(o.id) then o.consegna end, 'consegnata_il', case when o.stato = 'confermata' then o.consegnata_il end,
        -- consegnato ma da pagare (pagamento protetto acceso): il link si vede dopo il pagamento
        'consegna_bloccata', o.stato = 'confermata' and o.consegna is not null and privato.consegna_bloccata(o.id),
        'mie_stelle', case when o.stato = 'confermata' then o.stelle end, 'mia_recensione', case when o.stato = 'confermata' then o.recensione end,
        'si_recensisce', o.stato = 'confermata' and (o.consegnata_il is not null or v_z.data_desiderata <= current_date or o.confermata_il < now() - interval '7 days')
          and (o.recensione_il is null or o.recensione_il > now() - interval '30 days'),
        'pilota', json_build_object(
          -- nome completo, logo e pagina solo a lavoro confermato
          'nome', case when o.stato = 'confermata' then coalesce(nullif(g.nome, ''), p.azienda_nome, 'Pilota') else privato.nome_breve(coalesce(nullif(g.nome, ''), p.azienda_nome)) end,
          'logo', case when o.stato = 'confermata' then p.azienda_logo end, 'citta', g.citta, 'raggio_km', g.raggio_km,
          'presentazione', left(case when o.stato = 'confermata' then g.presentazione else privato.senza_nome(privato.senza_contatti(g.presentazione), coalesce(nullif(g.nome, ''), p.azienda_nome)) end, 600),
          -- gli attestati non si mostrano ai clienti: solo «registrato» e «assicurato»
          'servizi', g.servizi, 'assicurato', g.assicurato,
          'registrato', coalesce(g.codice_operatore, '') <> '',
          'stelle', privato.stelle_pilota(o.user_id),
          'portfolio', (select json_agg(f->>'url') from (select f from jsonb_array_elements(g.portfolio) f where f->>'tipo' is distinct from 'video' limit 6) q),
          'contatti', case when o.stato = 'confermata' then privato.pilota_contatto(o.user_id) - 'email' end
        )) order by (o.stato = 'confermata') desc, (o.stato = 'scelta') desc, o.prezzo)
      from public.offerte_zona o
      left join public.pagine_pilota g on g.user_id = o.user_id
      left join public.profili p on p.user_id = o.user_id
      where o.richiesta_id = v_z.id and o.stato not in ('decaduta', 'rinunciata')
    ), '[]'::json),
    -- piloti scelti che hanno detto «non posso farlo», con il motivo
    'rinunce', coalesce((
      select json_agg(json_build_object('nome', privato.nome_breve(coalesce(nullif(g.nome, ''), p.azienda_nome)), 'motivo', o.motivo_rinuncia))
      from public.offerte_zona o
      left join public.pagine_pilota g on g.user_id = o.user_id
      left join public.profili p on p.user_id = o.user_id
      where o.richiesta_id = v_z.id and o.stato = 'rinunciata'
    ), '[]'::json),
    -- scelte decadute: chiedo al cliente se il pilota l'ha contattato lo stesso
    'decadute', coalesce((
      select json_agg(json_build_object('id', o.id, 'nome', privato.nome_breve(coalesce(nullif(g.nome, ''), p.azienda_nome)), 'risposta', o.contatto_fuori))
      from public.offerte_zona o
      left join public.pagine_pilota g on g.user_id = o.user_id
      left join public.profili p on p.user_id = o.user_id
      where o.richiesta_id = v_z.id and o.stato = 'decaduta'
    ), '[]'::json)
  );
end;
$$;
revoke all on function public.offerte_cliente(text) from public;
grant execute on function public.offerte_cliente(text) to anon, authenticated;


-- la consegna del pilota (stessa di trova-pilota.sql): se il lavoro è da pagare, l'email non contiene il link
create or replace function public.consegna_lavoro_zona(p_offerta uuid, p_link text, p_nota text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona; v_z public.richieste_zona; v_link text := btrim(coalesce(p_link, ''));
begin
  select * into v_o from public.offerte_zona where id = p_offerta and user_id = auth.uid() and stato = 'confermata' for update;
  if not found then raise exception 'lavoro non trovato'; end if;
  if v_link !~ '^https://[^\s<>"]{4,}$' or length(v_link) > 600 then raise exception 'link non valido'; end if;
  select * into v_z from public.richieste_zona where id = v_o.richiesta_id;
  update public.offerte_zona
    set consegna = jsonb_build_object('link', v_link, 'nota', nullif(left(btrim(coalesce(p_nota, '')), 500), '')),
        consegnata_il = coalesce(consegnata_il, now())
    where id = v_o.id;
  -- l'email al cliente solo la prima volta (dopo, se il pilota cambia il link, il cliente lo trova aggiornato)
  if v_o.consegnata_il is null then
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'consegnato', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
      'pilota', privato.pilota_contatto(v_o.user_id)->>'nome', 'servizio', v_z.servizio,
      -- da pagare: niente link nell'email, il cliente paga dalla sua pagina e poi lo vede
      'link', case when privato.consegna_bloccata(v_o.id) then null else v_link end, 'bloccata', privato.consegna_bloccata(v_o.id),
      'nota', nullif(left(btrim(coalesce(p_nota, '')), 500), '')));
  end if;
  return true;
end;
$$;
revoke all on function public.consegna_lavoro_zona(uuid, text, text) from public;
grant execute on function public.consegna_lavoro_zona(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
