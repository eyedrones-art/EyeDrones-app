-- Trova un pilota, pezzo 3 di 5. Lanciali in ordine, uno alla volta (si possono rilanciare).
-- 5) il cliente invia la richiesta → { codice, piloti }: il codice è il suo link privato alle offerte
drop function if exists public.invia_richiesta_zona(text, text, text, text, text, text, date, text);
drop function if exists public.invia_richiesta_zona(text, text, text, text, text, text, date, text, numeric, numeric);
drop function if exists public.invia_richiesta_zona(text, text, text, text, text, text, date, text, numeric, numeric, text);
create or replace function public.invia_richiesta_zona(
  p_provincia text, p_nome text, p_email text, p_telefono text,
  p_servizio text, p_luogo text, p_data date, p_descrizione text,
  p_lat numeric default null, p_lon numeric default null, p_budget text default null
)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare
  v_prov text := upper(left(btrim(coalesce(p_provincia, '')), 2));
  v_nome text := left(btrim(coalesce(p_nome, '')), 80);
  v_email text := nullif(left(lower(btrim(coalesce(p_email, ''))), 120), '');
  v_tel text := nullif(left(btrim(coalesce(p_telefono, '')), 30), '');
  v_z public.richieste_zona;
  v_piloti jsonb;
begin
  if v_prov !~ '^[A-Z]{2}$' then raise exception 'provincia mancante'; end if;
  if length(v_nome) < 2 then raise exception 'nome mancante'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email non valida'; end if;
  if length(btrim(coalesce(p_descrizione, ''))) < 10 and coalesce(btrim(p_servizio), '') = '' then raise exception 'descrizione mancante'; end if;

  -- stessa persona: al massimo 3 richieste all'ora; in tutto al massimo 200 al giorno
  if (select count(*) from public.richieste_zona where created_at > now() - interval '1 hour' and email = v_email) >= 3
  then raise exception 'troppe richieste'; end if;
  if (select count(*) from public.richieste_zona where created_at > now() - interval '1 day') >= 200
  then raise exception 'troppe richieste'; end if;

  insert into public.richieste_zona (provincia, nome, email, telefono, servizio, luogo, data_desiderata, descrizione, lat, lon, lat_esatta, lon_esatta, budget)
  values (
    v_prov, v_nome, v_email, v_tel,
    nullif(left(btrim(coalesce(p_servizio, '')), 80), ''),
    nullif(left(btrim(coalesce(p_luogo, '')), 120), ''),
    case when p_data >= current_date and p_data < current_date + 730 then p_data end,
    nullif(left(btrim(coalesce(p_descrizione, '')), 2000), ''),
    -- solo punti in Italia (più o meno), arrotondati
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lat, 3) end,
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lon, 3) end,
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lat, 5) end,
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lon, 5) end,
    case when p_budget in ('fino_300', '300_700', '700_1500', 'oltre_1500') then p_budget end
  )
  returning * into v_z;

  -- avviso ai piloti della provincia (senza i contatti del cliente)
  select coalesce(jsonb_agg(privato.pilota_contatto(g.user_id)->>'email') filter (where privato.pilota_contatto(g.user_id)->>'email' is not null), '[]'::jsonb)
    into v_piloti
  from public.pagine_pilota g
  where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova and g.provincia = v_prov and coalesce(g.avviso_email, true);

  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', v_piloti,
    'servizio', v_z.servizio, 'luogo', v_z.luogo, 'data_desiderata', v_z.data_desiderata,
    'descrizione', left(privato.senza_contatti(v_z.descrizione), 400), 'provincia', v_prov));
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'richiesta_inviata', 'a', v_email, 'nome', v_nome,
    'codice', v_z.codice, 'piloti', jsonb_array_length(v_piloti), 'provincia', v_prov));

  return json_build_object('codice', v_z.codice, 'piloti', jsonb_array_length(v_piloti));
end;
$$;
revoke all on function public.invia_richiesta_zona(text, text, text, text, text, text, date, text, numeric, numeric, text) from public;
grant execute on function public.invia_richiesta_zona(text, text, text, text, text, text, date, text, numeric, numeric, text) to anon, authenticated;

-- 6) il cliente apre il link: la sua richiesta e le offerte (i contatti del pilota solo a lavoro confermato)
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
    'richiesta', json_build_object('nome', v_z.nome, 'provincia', v_z.provincia, 'servizio', v_z.servizio, 'luogo', v_z.luogo,
      'data_desiderata', v_z.data_desiderata, 'descrizione', v_z.descrizione, 'stato', v_z.stato, 'scelta_il', v_z.scelta_il,
      'created_at', v_z.created_at, 'budget', v_z.budget, 'diretta', v_z.pilota_diretto is not null),
    'offerte', coalesce((
      select json_agg(json_build_object(
        'id', o.id, 'prezzo', o.prezzo, 'dettagli', o.dettagli,
        'messaggio', case when o.stato = 'confermata' then o.messaggio else privato.senza_nome(privato.senza_contatti(o.messaggio), coalesce(nullif(g.nome, ''), p.azienda_nome)) end,
        'stato', o.stato, 'created_at', o.created_at,
        -- a lavoro confermato: la consegna e le stelle date dal cliente
        'consegna', case when o.stato = 'confermata' then o.consegna end, 'consegnata_il', case when o.stato = 'confermata' then o.consegnata_il end,
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

-- 7) il cliente sceglie un'offerta (o chiude la richiesta con p_offerta null)
create or replace function public.scegli_offerta(p_codice text, p_offerta uuid)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_z public.richieste_zona; v_o public.offerte_zona; v_comm numeric;
begin
  select * into v_z from public.richieste_zona where codice = p_codice for update;
  if not found then raise exception 'richiesta non trovata'; end if;
  if p_offerta is null then
    if v_z.stato = 'confermata' then raise exception 'già confermata'; end if;
    update public.offerte_zona set stato = 'non_scelta' where richiesta_id = v_z.id and stato in ('inviata', 'scelta');
    update public.richieste_zona set stato = 'chiusa', offerta_scelta = null, scelta_il = null where id = v_z.id;
    return true;
  end if;
  if v_z.stato <> 'aperta' then raise exception 'scelta non possibile'; end if;
  select * into v_o from public.offerte_zona where id = p_offerta and richiesta_id = v_z.id and stato = 'inviata';
  if not found then raise exception 'offerta non disponibile'; end if;
  v_comm := privato.commissione_per(v_o.prezzo);
  update public.offerte_zona set stato = 'scelta', commissione = v_comm where id = v_o.id;
  update public.richieste_zona set stato = 'scelta', offerta_scelta = v_o.id, scelta_il = now() where id = v_z.id;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'scelto', 'a', privato.pilota_contatto(v_o.user_id)->>'email',
    'pilota', privato.pilota_contatto(v_o.user_id)->>'nome', 'servizio', v_z.servizio, 'luogo', v_z.luogo,
    'data_desiderata', v_z.data_desiderata, 'prezzo', v_o.prezzo, 'commissione', v_comm));
  return true;
end;
$$;
revoke all on function public.scegli_offerta(text, uuid) from public;
grant execute on function public.scegli_offerta(text, uuid) to anon, authenticated;

-- il cliente risponde «il pilota mi ha contattato lo stesso?» dopo una scelta decaduta: se sì, il pilota è escluso
create or replace function public.segnala_contatto_fuori(p_codice text, p_offerta uuid, p_si boolean)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_uid uuid;
begin
  update public.offerte_zona o set contatto_fuori = p_si
    from public.richieste_zona z
    where o.id = p_offerta and z.id = o.richiesta_id and z.codice = p_codice and o.stato = 'decaduta' and o.contatto_fuori is null
    returning o.user_id into v_uid;
  if v_uid is null then return false; end if;
  if p_si then update public.pagine_pilota set escluso_trova = true where user_id = v_uid; end if;
  return true;
end;
$$;
revoke all on function public.segnala_contatto_fuori(text, uuid, boolean) from public;
grant execute on function public.segnala_contatto_fuori(text, uuid, boolean) to anon, authenticated;

