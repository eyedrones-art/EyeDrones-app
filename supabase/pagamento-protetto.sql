-- EyeDrones — «🛡️ Pagamento protetto» (come Vinted): il cliente paga nell'app, i soldi restano fermi su Stripe
-- e arrivano al pilota quando il cliente conferma «ho ricevuto il lavoro» (o da soli qualche giorno dopo la consegna).
-- Il pilota riceve il 100% del suo prezzo; il cliente paga in più la «Protezione EyeDrones» (percentuale + quota fissa).
-- Il cliente può pagare un anticipo (es. 30%) e il resto dopo, oppure tutto subito.
-- I soldi non passano mai da un conto di EyeDrones: restano su Stripe (Stripe Connect) fino al trasferimento al pilota.
--
-- SPENTO finché non c'è la P.IVA e Stripe è in modalità live. Per accenderlo:
--   update privato.impostazioni set valore = 'si' where chiave = 'pagamento_protetto_attivo';
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.

insert into privato.impostazioni (chiave, valore) values
  ('pagamento_protetto_attivo', 'no'),  -- 'si' = il cliente vede «Paga con Pagamento protetto»
  ('protezione_percento', '5'),         -- Protezione EyeDrones pagata dal cliente: percentuale...
  ('protezione_fisso', '0.70'),         -- ...più questa quota fissa (euro) per ogni pagamento
  ('anticipo_percento', '30'),          -- anticipo proposto al cliente
  ('rilascio_giorni', '3')              -- giorni dopo la consegna in cui i soldi vanno al pilota anche senza conferma
on conflict (chiave) do nothing;

-- il conto Stripe del pilota (lo crea la funzione Netlify pagamento-protetto quando il pilota tocca «Collega»)
create table if not exists privato.piloti_stripe (
  user_id uuid primary key references auth.users(id) on delete cascade,
  account_id text not null unique,
  pronto boolean not null default false,  -- Stripe ha controllato i documenti: può ricevere i soldi
  aggiornato timestamptz not null default now()
);
revoke all on privato.piloti_stripe from public, anon, authenticated;

-- i pagamenti del cliente: niente carte né IBAN, solo importi e riferimenti Stripe
create table if not exists public.pagamenti_protetti (
  id uuid primary key default gen_random_uuid(),
  offerta_id uuid not null references public.offerte_zona(id) on delete cascade,
  richiesta_id uuid not null references public.richieste_zona(id) on delete cascade,
  pilota uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('anticipo', 'saldo', 'totale')),
  importo_pilota numeric(10,2) not null check (importo_pilota > 0),
  protezione numeric(10,2) not null check (protezione >= 0),
  sessione text not null unique,
  payment_intent text,
  stato text not null default 'pagato' check (stato in ('pagato', 'da_rimborsare', 'rilasciato', 'rimborsato')),
  pagato_il timestamptz not null default now(),
  chiuso_il timestamptz,
  riferimento text            -- id del trasferimento o del rimborso su Stripe
);
create index if not exists pagamenti_protetti_offerta_idx on public.pagamenti_protetti (offerta_id);
alter table public.pagamenti_protetti enable row level security; -- nessuna regola: si passa solo dalle funzioni qui sotto

alter table public.offerte_zona add column if not exists protetto_ricevuto_il timestamptz; -- il cliente ha confermato
alter table public.offerte_zona add column if not exists protetto_problema text;           -- il cliente ha segnalato un problema
alter table public.offerte_zona add column if not exists protetto_problema_il timestamptz;

-- impostazioni lette una volta
create or replace function privato.protezione_conf()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'attivo', coalesce(max(valore) filter (where chiave = 'pagamento_protetto_attivo'), 'no') = 'si',
    'percento', coalesce(max(valore) filter (where chiave = 'protezione_percento'), '5')::numeric,
    'fisso', coalesce(max(valore) filter (where chiave = 'protezione_fisso'), '0.70')::numeric,
    'anticipo', coalesce(max(valore) filter (where chiave = 'anticipo_percento'), '30')::numeric,
    'giorni', coalesce(max(valore) filter (where chiave = 'rilascio_giorni'), '3')::int)
  from privato.impostazioni
  where chiave in ('pagamento_protetto_attivo', 'protezione_percento', 'protezione_fisso', 'anticipo_percento', 'rilascio_giorni');
$$;
revoke all on function privato.protezione_conf() from public, anon, authenticated;

-- la protezione per un importo (al centesimo)
create or replace function privato.protezione_per(p_importo numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select round(p_importo * (c ->> 'percento')::numeric / 100 + (c ->> 'fisso')::numeric, 2) from privato.protezione_conf() c;
$$;
revoke all on function privato.protezione_per(numeric) from public, anon, authenticated;

-- la situazione di un lavoro confermato: quanto è stato pagato, quanto manca, cosa può fare il cliente
create or replace function privato.protezione_stato(p_offerta uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare o public.offerte_zona; c jsonb := privato.protezione_conf(); v_pagato numeric; v_ril numeric; v_rimb numeric;
        v_resto numeric; v_anticipo numeric; v_pronto boolean;
begin
  select * into o from public.offerte_zona where id = p_offerta;
  if not found then return null; end if;
  select coalesce(sum(importo_pilota) filter (where stato in ('pagato', 'rilasciato')), 0),
         coalesce(sum(importo_pilota) filter (where stato = 'rilasciato'), 0),
         coalesce(sum(importo_pilota) filter (where stato in ('da_rimborsare', 'rimborsato')), 0)
    into v_pagato, v_ril, v_rimb
    from public.pagamenti_protetti where offerta_id = o.id;
  v_resto := greatest(round(o.prezzo - v_pagato, 2), 0);
  v_anticipo := round(o.prezzo * (c ->> 'anticipo')::numeric / 100, 2);
  v_pronto := coalesce((select pronto from privato.piloti_stripe where user_id = o.user_id), false);
  return jsonb_build_object(
    'prezzo', o.prezzo,
    'pronto', v_pronto,
    'pagato', v_pagato, 'rilasciato', v_ril, 'rimborsato', v_rimb, 'resto', v_resto,
    'anticipo', jsonb_build_object('pilota', v_anticipo, 'protezione', privato.protezione_per(v_anticipo)),
    'totale', jsonb_build_object('pilota', o.prezzo, 'protezione', privato.protezione_per(o.prezzo)),
    'saldo', case when v_pagato > 0 and v_resto > 0 then jsonb_build_object('pilota', v_resto, 'protezione', privato.protezione_per(v_resto)) end,
    'percento', c -> 'percento', 'fisso', c -> 'fisso', 'percento_anticipo', c -> 'anticipo',
    'ricevuto_il', o.protetto_ricevuto_il,
    'problema', o.protetto_problema, 'problema_il', o.protetto_problema_il,
    'consegnata_il', o.consegnata_il,
    'rilascio_il', case when o.consegnata_il is not null then o.consegnata_il + make_interval(days => (c ->> 'giorni')::int) end);
end $$;
revoke all on function privato.protezione_stato(uuid) from public, anon, authenticated;

-- 1) il cliente (con il suo link): il riquadro «Pagamento protetto» del lavoro confermato. Spento → null
create or replace function public.protezione_cliente(p_codice text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_off uuid; s jsonb;
begin
  if not (privato.protezione_conf() ->> 'attivo')::boolean then return null; end if;
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then return null; end if;
  select o.id into v_off from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
    where z.codice = p_codice and o.stato = 'confermata' limit 1;
  if v_off is null then return null; end if;
  s := privato.protezione_stato(v_off);
  -- pilota senza conto Stripe e niente pagato: il riquadro non compare
  if not (s ->> 'pronto')::boolean and (s ->> 'pagato')::numeric = 0 then return null; end if;
  return s || jsonb_build_object('offerta', v_off);
end $$;
revoke all on function public.protezione_cliente(text) from public;
grant execute on function public.protezione_cliente(text) to anon, authenticated;

-- 2) per la funzione Netlify (solo con il codice segreto): quanto far pagare e a chi, per aprire il pagamento Stripe
create or replace function public.protezione_importi(p_codice text, p_tipo text, p_segreto text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_z public.richieste_zona; v_o public.offerte_zona; s jsonb; v_acc text; v_pilota numeric;
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  if not (privato.protezione_conf() ->> 'attivo')::boolean then raise exception 'pagamento protetto spento'; end if;
  select * into v_z from public.richieste_zona where codice = p_codice;
  if not found then raise exception 'richiesta non trovata'; end if;
  select * into v_o from public.offerte_zona where richiesta_id = v_z.id and stato = 'confermata';
  if not found then raise exception 'nessun lavoro confermato'; end if;
  -- dopo «ho ricevuto il lavoro» si può ancora pagare il resto (va subito al pilota), ma non un nuovo anticipo
  if v_o.protetto_ricevuto_il is not null and p_tipo <> 'saldo' then raise exception 'lavoro già concluso'; end if;
  select account_id into v_acc from privato.piloti_stripe where user_id = v_o.user_id and pronto;
  if v_acc is null then raise exception 'il pilota non riceve ancora pagamenti protetti'; end if;
  s := privato.protezione_stato(v_o.id);
  if p_tipo in ('anticipo', 'totale') and (s ->> 'pagato')::numeric > 0 then raise exception 'già pagato'; end if;
  if p_tipo = 'saldo' and s -> 'saldo' = 'null'::jsonb then raise exception 'niente da pagare'; end if;
  if p_tipo not in ('anticipo', 'saldo', 'totale') then raise exception 'tipo sconosciuto'; end if;
  v_pilota := (s -> p_tipo ->> 'pilota')::numeric;
  return jsonb_build_object('offerta', v_o.id, 'tipo', p_tipo, 'pilota', v_pilota, 'protezione', (s -> p_tipo ->> 'protezione')::numeric,
    'account', v_acc, 'email', v_z.email, 'servizio', v_z.servizio, 'luogo', v_z.luogo);
end $$;
revoke all on function public.protezione_importi(text, text, text) from public;
grant execute on function public.protezione_importi(text, text, text) to anon, authenticated;

-- 3) Stripe conferma il pagamento (dal webhook, solo con il codice segreto). Lo stesso pagamento non conta mai due volte
create or replace function public.protezione_pagato(p_offerta uuid, p_tipo text, p_pilota numeric, p_protezione numeric,
                                                    p_sessione text, p_intent text, p_segreto text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_o public.offerte_zona; v_z public.richieste_zona; v_id uuid;
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    return false;
  end if;
  select * into v_o from public.offerte_zona where id = p_offerta;
  if not found then return false; end if;
  select * into v_z from public.richieste_zona where id = v_o.richiesta_id;
  insert into public.pagamenti_protetti (offerta_id, richiesta_id, pilota, tipo, importo_pilota, protezione, sessione, payment_intent,
                                         stato)
  values (v_o.id, v_o.richiesta_id, v_o.user_id, p_tipo, p_pilota, p_protezione, p_sessione, p_intent,
          -- pagato mentre il lavoro veniva annullato: va restituito
          case when v_o.stato = 'confermata' then 'pagato' else 'da_rimborsare' end)
  on conflict (sessione) do nothing
  returning id into v_id;
  if v_id is null then return true; end if; -- già registrato
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'protetto_pagato', 'a', privato.pilota_contatto(v_o.user_id) ->> 'email',
    'servizio', v_z.servizio, 'luogo', v_z.luogo, 'importo', p_pilota, 'quale', p_tipo, 'prezzo', v_o.prezzo));
  return true;
end $$;
revoke all on function public.protezione_pagato(uuid, text, numeric, numeric, text, text, text) from public;
grant execute on function public.protezione_pagato(uuid, text, numeric, numeric, text, text, text) to anon, authenticated;

-- 4) il cliente conferma «ho ricevuto il lavoro»: i soldi possono andare al pilota
create or replace function public.protezione_ricevuto(p_codice text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_off uuid;
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then raise exception 'richiesta non trovata'; end if;
  select o.id into v_off from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
    where z.codice = p_codice and o.stato = 'confermata' limit 1;
  if v_off is null then raise exception 'nessun lavoro confermato'; end if;
  if not exists (select 1 from public.pagamenti_protetti where offerta_id = v_off and stato = 'pagato') then raise exception 'niente da sbloccare'; end if;
  update public.offerte_zona set protetto_ricevuto_il = coalesce(protetto_ricevuto_il, now()), protetto_problema = null, protetto_problema_il = null
    where id = v_off;
  return true;
end $$;
revoke all on function public.protezione_ricevuto(text) from public;
grant execute on function public.protezione_ricevuto(text) to anon, authenticated;

-- 5) il cliente segnala un problema: i soldi restano fermi finché EyeDrones non decide
create or replace function public.protezione_problema(p_codice text, p_testo text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_o public.offerte_zona; v_z public.richieste_zona; v_t text := left(btrim(privato.senza_contatti(coalesce(p_testo, ''))), 600);
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then raise exception 'richiesta non trovata'; end if;
  if length(v_t) < 5 then raise exception 'scrivi cosa non va'; end if;
  select * into v_z from public.richieste_zona where codice = p_codice;
  if not found then raise exception 'richiesta non trovata'; end if;
  select * into v_o from public.offerte_zona where richiesta_id = v_z.id and stato = 'confermata' for update;
  if not found then raise exception 'nessun lavoro confermato'; end if;
  if v_o.protetto_ricevuto_il is not null then raise exception 'lavoro già confermato'; end if;
  if not exists (select 1 from public.pagamenti_protetti where offerta_id = v_o.id and stato = 'pagato') then raise exception 'niente pagato'; end if;
  update public.offerte_zona set protetto_problema = v_t, protetto_problema_il = now() where id = v_o.id;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'protetto_problema', 'a', privato.pilota_contatto(v_o.user_id) ->> 'email',
    'servizio', v_z.servizio, 'luogo', v_z.luogo, 'provincia', v_z.provincia, 'problema', v_t, 'prezzo', v_o.prezzo));
  return true;
end $$;
revoke all on function public.protezione_problema(text, text) from public;
grant execute on function public.protezione_problema(text, text) to anon, authenticated;

-- 6) cosa c'è da fare su Stripe (lo chiede la funzione Netlify, solo con il codice segreto):
--    rilasciare = soldi da trasferire al pilota (cliente ha confermato, oppure consegnato da N giorni senza problemi)
--    rimborsare = soldi da restituire al cliente (lavoro annullato dal pilota, o deciso da EyeDrones)
create or replace function public.protezione_da_fare(p_segreto text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare g int := (privato.protezione_conf() ->> 'giorni')::int;
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  return jsonb_build_object(
    'rilasciare', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'offerta', p.offerta_id, 'account', s.account_id,
                                          'centesimi', round(p.importo_pilota * 100)::int, 'intent', p.payment_intent))
      from public.pagamenti_protetti p
      join public.offerte_zona o on o.id = p.offerta_id
      join privato.piloti_stripe s on s.user_id = p.pilota and s.pronto
      where p.stato = 'pagato' and o.stato = 'confermata' and o.protetto_problema is null
        and (o.protetto_ricevuto_il is not null or o.consegnata_il < now() - make_interval(days => g))), '[]'::jsonb),
    'rimborsare', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.id, 'offerta', p.offerta_id, 'intent', p.payment_intent))
      from public.pagamenti_protetti p
      join public.offerte_zona o on o.id = p.offerta_id
      where p.stato = 'da_rimborsare'
         or (p.stato = 'pagato' and o.stato = 'annullata' and (to_jsonb(o) ->> 'annullata_da') = 'pilota')), '[]'::jsonb));
end $$;
revoke all on function public.protezione_da_fare(text) from public;
grant execute on function public.protezione_da_fare(text) to anon, authenticated;

-- 7) Stripe ha eseguito: segno il pagamento come rilasciato o rimborsato e avviso chi riceve i soldi
create or replace function public.protezione_fatto(p_id uuid, p_esito text, p_riferimento text, p_segreto text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare p public.pagamenti_protetti; v_z public.richieste_zona;
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    return false;
  end if;
  if p_esito not in ('rilasciato', 'rimborsato') then return false; end if;
  update public.pagamenti_protetti set stato = p_esito, chiuso_il = now(), riferimento = left(p_riferimento, 80)
    where id = p_id and stato in ('pagato', 'da_rimborsare') returning * into p;
  if not found then return true; end if;
  select * into v_z from public.richieste_zona where id = p.richiesta_id;
  if p_esito = 'rilasciato' then
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'protetto_rilasciato', 'a', privato.pilota_contatto(p.pilota) ->> 'email',
      'servizio', v_z.servizio, 'luogo', v_z.luogo, 'importo', p.importo_pilota));
  else
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'protetto_rimborsato', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
      'servizio', v_z.servizio, 'importo', p.importo_pilota + p.protezione));
  end if;
  return true;
end $$;
revoke all on function public.protezione_fatto(uuid, text, text, text) from public;
grant execute on function public.protezione_fatto(uuid, text, text, text) to anon, authenticated;

-- 8) il conto Stripe del pilota (per la funzione Netlify, solo con il codice segreto)
create or replace function public.protezione_account(p_uid uuid, p_segreto text)
returns text language plpgsql stable security definer set search_path = public as $$
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  return (select account_id from privato.piloti_stripe where user_id = p_uid);
end $$;
revoke all on function public.protezione_account(uuid, text) from public;
grant execute on function public.protezione_account(uuid, text) to anon, authenticated;

create or replace function public.protezione_salva_account(p_uid uuid, p_account text, p_pronto boolean, p_segreto text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    return false;
  end if;
  if p_account !~ '^acct_[A-Za-z0-9]{6,40}$' then return false; end if;
  insert into privato.piloti_stripe (user_id, account_id, pronto) values (p_uid, p_account, coalesce(p_pronto, false))
  on conflict (user_id) do update set account_id = excluded.account_id, pronto = excluded.pronto, aggiornato = now();
  return true;
end $$;
revoke all on function public.protezione_salva_account(uuid, text, boolean, text) from public;
grant execute on function public.protezione_salva_account(uuid, text, boolean, text) to anon, authenticated;

-- 9) per il pilota: il suo conto e i pagamenti dei suoi lavori (id richiesta → situazione). Spento → null
create or replace function public.protezione_pilota()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not (privato.protezione_conf() ->> 'attivo')::boolean then return null; end if;
  return jsonb_build_object(
    'collegato', exists (select 1 from privato.piloti_stripe where user_id = v_uid),
    'pronto', coalesce((select pronto from privato.piloti_stripe where user_id = v_uid), false),
    'lavori', coalesce((
      select jsonb_object_agg(o.richiesta_id, privato.protezione_stato(o.id) - 'anticipo' - 'totale' - 'saldo')
      from public.offerte_zona o
      where o.user_id = v_uid and exists (select 1 from public.pagamenti_protetti p where p.offerta_id = o.id)), '{}'::jsonb));
end $$;
revoke all on function public.protezione_pilota() from public;
grant execute on function public.protezione_pilota() to authenticated;

-- 10) per l'amministratore: tutti i lavori con pagamenti protetti, e le due decisioni in caso di problema
create or replace function public.protezione_admin()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it') then return null; end if;
  return coalesce((
    select jsonb_agg(riga order by (riga ->> 'ultimo') desc)
    from (
      select jsonb_build_object('offerta', o.id, 'servizio', z.servizio, 'luogo', z.luogo, 'provincia', z.provincia,
        'stato_lavoro', o.stato, 'ultimo', max(p.pagato_il),
        'protezione', sum(p.protezione) filter (where p.stato in ('pagato', 'rilasciato')),
        'situazione', privato.protezione_stato(o.id) - 'anticipo' - 'totale' - 'saldo',
        'da_rimborsare', bool_or(p.stato = 'da_rimborsare')) as riga
      from public.pagamenti_protetti p
      join public.offerte_zona o on o.id = p.offerta_id
      join public.richieste_zona z on z.id = o.richiesta_id
      group by o.id, z.id
      order by max(p.pagato_il) desc
      limit 60
    ) x), '[]'::jsonb);
end $$;
revoke all on function public.protezione_admin() from public;
grant execute on function public.protezione_admin() to authenticated;

create or replace function public.protezione_decidi(p_offerta uuid, p_decisione text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it') then raise exception 'non autorizzato'; end if;
  if p_decisione = 'pilota' then
    -- i soldi vanno al pilota
    update public.offerte_zona set protetto_ricevuto_il = coalesce(protetto_ricevuto_il, now()), protetto_problema = null, protetto_problema_il = null
      where id = p_offerta;
  elsif p_decisione = 'cliente' then
    -- i soldi tornano al cliente (tutto quello non ancora trasferito al pilota)
    update public.pagamenti_protetti set stato = 'da_rimborsare' where offerta_id = p_offerta and stato = 'pagato';
  else
    raise exception 'decisione sconosciuta';
  end if;
  return true;
end $$;
revoke all on function public.protezione_decidi(uuid, text) from public;
grant execute on function public.protezione_decidi(uuid, text) to authenticated;

notify pgrst, 'reload schema';
