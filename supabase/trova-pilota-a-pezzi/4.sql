-- Trova un pilota, pezzo 4 di 5. Lanciali in ordine, uno alla volta (si possono rilanciare).
-- 8) il pilota: le richieste della sua provincia (senza contatti) con la sua offerta, se l'ha fatta
create or replace function public.lavori_in_zona()
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return '[]'::json; end if;
  perform privato.scadi_scelte();
  return coalesce((
    select json_agg(json_build_object(
      'id', z.id, 'servizio', z.servizio, 'luogo', z.luogo, 'data_desiderata', z.data_desiderata,
      'lat', coalesce(z.lat_esatta, z.lat), 'lon', coalesce(z.lon_esatta, z.lon), 'esatto', z.lat_esatta is not null, 'budget', z.budget,
      'descrizione', privato.senza_contatti(z.descrizione), 'created_at', z.created_at, 'stato', z.stato,
      -- «richiedi di nuovo»: un cliente che ha già lavorato con lui (il nome lo conosce già)
      'diretto', z.pilota_diretto is not null, 'cliente', case when z.pilota_diretto is not null then z.nome end,
      'offerte', (select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato <> 'decaduta'),
      'mia', (select json_build_object('id', o.id, 'prezzo', o.prezzo, 'messaggio', o.messaggio, 'dettagli', o.dettagli, 'stato', o.stato,
                'commissione', o.commissione, 'scade', z.scelta_il + interval '48 hours',
                'consegna', o.consegna, 'consegnata_il', o.consegnata_il, 'stelle', o.stelle, 'recensione', o.recensione)
              from public.offerte_zona o where o.richiesta_id = z.id and o.user_id = v_uid)
    ) order by z.created_at desc)
    from public.richieste_zona z
    join public.pagine_pilota g on g.user_id = v_uid and g.attiva
    where ((z.pilota_diretto is null and g.provincia = z.provincia) or z.pilota_diretto = v_uid)
      and (z.created_at > now() - interval '60 days'
        -- i lavori confermati restano di più, per consegnarli
        or exists (select 1 from public.offerte_zona x where x.richiesta_id = z.id and x.user_id = v_uid and x.stato = 'confermata' and x.confermata_il > now() - interval '120 days'))
      and (
        -- aperte: se non è stato escluso, la data non è passata e c'è ancora posto (o ha già offerto)
        (z.stato = 'aperta' and g.scelte_decadute < 2 and not g.escluso_trova and (z.data_desiderata is null or z.data_desiderata >= current_date)
          and ((select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato <> 'decaduta') < 8
               or exists (select 1 from public.offerte_zona x where x.richiesta_id = z.id and x.user_id = v_uid)))
        -- e tutte quelle dove ha fatto un'offerta, per sapere com'è andata
        or exists (select 1 from public.offerte_zona x where x.richiesta_id = z.id and x.user_id = v_uid)
      )
  ), '[]'::json);
end;
$$;
revoke all on function public.lavori_in_zona() from public;
grant execute on function public.lavori_in_zona() to authenticated;

-- 9) il pilota manda (o cambia) la sua offerta
drop function if exists public.invia_offerta_zona(uuid, numeric, text);
-- solo le voci previste, con numeri ragionevoli
create or replace function privato.dettagli_offerta(d jsonb)
returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'video_min', case when (d->>'video_min') ~ '^\d{1,3}$' and (d->>'video_min')::int between 1 and 180 then (d->>'video_min')::int end,
    'foto', case when (d->>'foto') ~ '^\d{1,4}$' and (d->>'foto')::int between 1 and 2000 then (d->>'foto')::int end,
    'consegna_giorni', case when (d->>'consegna_giorni') ~ '^\d{1,3}$' and (d->>'consegna_giorni')::int between 1 and 365 then (d->>'consegna_giorni')::int end,
    'ettari', case when (d->>'ettari') ~ '^\d{1,5}([.,]\d{1,2})?$' and replace(d->>'ettari', ',', '.')::numeric between 0.01 and 50000 then replace(d->>'ettari', ',', '.')::numeric end,
    'kwp', case when (d->>'kwp') ~ '^\d{1,6}$' and (d->>'kwp')::int between 1 and 500000 then (d->>'kwp')::int end,
    'reel', case when (d->>'reel') = 'true' then true end,
    'ortofoto', case when (d->>'ortofoto') = 'true' then true end,
    'modello3d', case when (d->>'modello3d') = 'true' then true end,
    'rtk', case when (d->>'rtk') = 'true' then true end,
    'report', case when (d->>'report') = 'true' then true end,
    'radiometrico', case when (d->>'radiometrico') = 'true' then true end,
    'registro', case when (d->>'registro') = 'true' then true end,
    'permessi', case when (d->>'permessi') = 'true' then true end,
    'sopralluogo', case when (d->>'sopralluogo') = 'true' then true end,
    -- il regime fiscale del pilota: il cliente legge «IVA compresa» o «senza IVA» sotto il prezzo
    'regime', case when (d->>'regime') in ('ordinario', 'forfettario', 'occasionale') then d->>'regime' end));
$$;
create or replace function public.invia_offerta_zona(p_richiesta uuid, p_prezzo numeric, p_messaggio text, p_dettagli jsonb default '{}')
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_z public.richieste_zona; v_nuova boolean;
begin
  if v_uid is null then raise exception 'accesso richiesto'; end if;
  if p_prezzo is null or p_prezzo < 10 or p_prezzo > 100000 then raise exception 'prezzo non valido'; end if;
  select z.* into v_z from public.richieste_zona z
    join public.pagine_pilota g on g.user_id = v_uid and g.attiva and g.scelte_decadute < 2 and not g.escluso_trova
    where z.id = p_richiesta and z.stato = 'aperta' and ((z.pilota_diretto is null and g.provincia = z.provincia) or z.pilota_diretto = v_uid)
    for update of z;
  if not found then raise exception 'richiesta non disponibile'; end if;
  v_nuova := not exists (select 1 from public.offerte_zona where richiesta_id = v_z.id and user_id = v_uid);
  if v_nuova and (select count(*) from public.offerte_zona where richiesta_id = v_z.id and stato <> 'decaduta') >= 8 then
    raise exception 'offerte al completo';
  end if;
  insert into public.offerte_zona (richiesta_id, user_id, prezzo, messaggio, dettagli)
  values (v_z.id, v_uid, round(p_prezzo, 2), nullif(left(btrim(coalesce(p_messaggio, '')), 1500), ''), privato.dettagli_offerta(coalesce(p_dettagli, '{}')))
  on conflict (richiesta_id, user_id) do update set prezzo = excluded.prezzo, messaggio = excluded.messaggio, dettagli = excluded.dettagli
    where public.offerte_zona.stato = 'inviata';
  if v_nuova then
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuova_offerta', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
      'pilota', privato.nome_breve(privato.pilota_contatto(v_uid)->>'nome'), 'prezzo', round(p_prezzo, 2), 'servizio', v_z.servizio));
  end if;
  return true;
end;
$$;
revoke all on function public.invia_offerta_zona(uuid, numeric, text, jsonb) from public;
grant execute on function public.invia_offerta_zona(uuid, numeric, text, jsonb) to authenticated;

-- 10) conferma: il lavoro passa al pilota, con i contatti (uso interno)
create or replace function privato.conferma_offerta(p_offerta uuid, p_sessione text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_o public.offerte_zona; v_z public.richieste_zona; v_p jsonb;
begin
  select * into v_o from public.offerte_zona where id = p_offerta for update;
  if not found then return false; end if;
  if v_o.stato = 'confermata' then return true; end if;
  if v_o.stato <> 'scelta' then return false; end if;
  select * into v_z from public.richieste_zona where id = v_o.richiesta_id for update;
  update public.offerte_zona set stato = 'confermata', confermata_il = now(), pagata_sessione = p_sessione where id = v_o.id;
  update public.offerte_zona set stato = 'non_scelta' where richiesta_id = v_z.id and id <> v_o.id and stato = 'inviata';
  update public.richieste_zona set stato = 'confermata' where id = v_z.id;
  insert into public.richieste_preventivo (user_id, nome, email, telefono, servizio, luogo, data_desiderata, descrizione, da_zona)
  values (v_o.user_id, v_z.nome, v_z.email, v_z.telefono, v_z.servizio, v_z.luogo, v_z.data_desiderata,
    concat_ws(E'\n\n', v_z.descrizione,
      case when v_z.lat_esatta is not null then '📍 Punto esatto indicato dal cliente: ' || v_z.lat_esatta || ', ' || v_z.lon_esatta
        || ' — https://www.google.com/maps/search/?api=1&query=' || v_z.lat_esatta || ',' || v_z.lon_esatta
        || E'\nRicontrolla zone e limiti su questo punto (Permessi → Assistente) e su D-Flight prima del volo.' end,
      '— Lavoro confermato da «Trova un pilota»: la tua offerta era di ' || replace(to_char(v_o.prezzo, 'FM9999990.00'), '.', ',') || ' €.'),
    v_z.id)
  on conflict do nothing;
  v_p := privato.pilota_contatto(v_o.user_id);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'confermato', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
    'pilota', v_p->>'nome', 'pilota_email', v_p->>'email_pubblica', 'pilota_telefono', v_p->>'telefono', 'pilota_slug', v_p->>'slug',
    'prezzo', v_o.prezzo));
  return true;
end; $$;
revoke all on function privato.conferma_offerta(uuid, text) from public, anon, authenticated;

-- il pilota scelto conferma: con la commissione a 0 il lavoro è suo subito; altrimenti risponde quanto pagare
create or replace function public.conferma_lavoro_zona(p_offerta uuid)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona;
begin
  perform privato.scadi_scelte();
  select * into v_o from public.offerte_zona where id = p_offerta and user_id = auth.uid();
  if not found or v_o.stato not in ('scelta', 'confermata') then raise exception 'offerta non disponibile'; end if;
  if v_o.stato = 'confermata' then return json_build_object('confermato', true); end if;
  if coalesce(v_o.commissione, 0) > 0 then return json_build_object('confermato', false, 'da_pagare', v_o.commissione); end if;
  perform privato.conferma_offerta(v_o.id, null);
  return json_build_object('confermato', true);
end;
$$;
revoke all on function public.conferma_lavoro_zona(uuid) from public;
grant execute on function public.conferma_lavoro_zona(uuid) to authenticated;

-- il pilota scelto non può fare il lavoro (zona, categoria, persone…): lo dice e il cliente torna a scegliere, senza penalità
create or replace function public.rinuncia_lavoro_zona(p_offerta uuid, p_motivo text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona; v_z public.richieste_zona; v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
begin
  select * into v_o from public.offerte_zona where id = p_offerta and user_id = auth.uid() and stato = 'scelta' for update;
  if not found then raise exception 'offerta non disponibile'; end if;
  if v_motivo is null then raise exception 'motivo mancante'; end if;
  select * into v_z from public.richieste_zona where id = v_o.richiesta_id for update;
  update public.offerte_zona set stato = 'rinunciata', motivo_rinuncia = privato.senza_contatti(v_motivo) where id = v_o.id;
  update public.richieste_zona set stato = 'aperta', offerta_scelta = null, scelta_il = null where id = v_z.id;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'rinuncia', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
    'pilota', privato.nome_breve(privato.pilota_contatto(v_o.user_id)->>'nome'), 'motivo', privato.senza_contatti(v_motivo)));
  return true;
end;
$$;
revoke all on function public.rinuncia_lavoro_zona(uuid, text) from public;
grant execute on function public.rinuncia_lavoro_zona(uuid, text) to authenticated;

-- quanto deve pagare il pilota per un'offerta scelta (lo chiede la funzione Netlify lavoro-pagamento, come il pilota)
create or replace function public.commissione_lavoro(p_offerta uuid)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object('commissione', o.commissione, 'servizio', z.servizio, 'luogo', z.luogo)
  from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
  where o.id = p_offerta and o.user_id = auth.uid() and o.stato = 'scelta' and z.scelta_il > now() - interval '48 hours';
$$;
revoke all on function public.commissione_lavoro(uuid) from public;
grant execute on function public.commissione_lavoro(uuid) to authenticated;

-- pagamento arrivato da Stripe (lo chiama stripe-webhook, solo con il codice segreto)
create or replace function public.conferma_lavoro_pagato(p_offerta uuid, p_utente uuid, p_sessione text, p_segreto text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_segreto text;
begin
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_segreto is null or p_segreto is distinct from v_segreto then return false; end if;
  if not exists (select 1 from public.offerte_zona where id = p_offerta and user_id = p_utente) then return false; end if;
  if exists (select 1 from public.offerte_zona where pagata_sessione = p_sessione and id <> p_offerta) then return false; end if;
  -- pagato proprio mentre la scelta scadeva: se il cliente non ha ancora scelto un altro, il lavoro resta suo
  update public.offerte_zona o set stato = 'scelta'
    from public.richieste_zona z
    where o.id = p_offerta and o.stato = 'decaduta' and z.id = o.richiesta_id and z.stato = 'aperta';
  update public.richieste_zona z set stato = 'scelta', offerta_scelta = p_offerta, scelta_il = now()
    from public.offerte_zona o
    where o.id = p_offerta and o.stato = 'scelta' and z.id = o.richiesta_id and z.stato = 'aperta';
  if privato.conferma_offerta(p_offerta, p_sessione) then return true; end if;
  -- non più possibile (il cliente ha scelto un altro): lo segno da rimborsare, Stripe non deve riprovare
  update public.offerte_zona set da_rimborsare = true, pagata_sessione = p_sessione where id = p_offerta and pagata_sessione is null;
  return true;
end;
$$;
revoke all on function public.conferma_lavoro_pagato(uuid, uuid, text, text) from public;
grant execute on function public.conferma_lavoro_pagato(uuid, uuid, text, text) to anon, authenticated;

-- le versioni di prova (prima di «scegli e poi paga») non servono più
drop function if exists public.prendi_lavoro_in_zona(uuid);

