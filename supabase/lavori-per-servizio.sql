-- EyeDrones — aggiornamento di «Trova un pilota» (8 novembre 2026)
-- 1) il lavoro va solo ai piloti che fanno quel servizio: prima la provincia, poi la regione, altrimenti a nessuno
-- 2) provincia senza piloti per quel servizio: la richiesta va ai piloti della stessa regione che lo fanno
-- Sono le stesse parti già scritte in trova-pilota.sql: basta eseguire questo, non serve rilanciare quello lungo.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
-- Serve trova-pilota.sql già eseguito.

-- provincia senza piloti: la richiesta va ai piloti della stessa regione
alter table public.richieste_zona add column if not exists in_regione boolean not null default false;

-- province e regioni (per girare la richiesta alla regione quando la provincia non ha piloti)
create table if not exists privato.regioni (sigla text primary key, regione text not null);
revoke all on privato.regioni from public, anon, authenticated;
insert into privato.regioni (sigla, regione) values
  ('AL', 'Piemonte'),
  ('AT', 'Piemonte'),
  ('BI', 'Piemonte'),
  ('CN', 'Piemonte'),
  ('NO', 'Piemonte'),
  ('TO', 'Piemonte'),
  ('VB', 'Piemonte'),
  ('VC', 'Piemonte'),
  ('AO', 'Valle d''Aosta'),
  ('BG', 'Lombardia'),
  ('BS', 'Lombardia'),
  ('CO', 'Lombardia'),
  ('CR', 'Lombardia'),
  ('LC', 'Lombardia'),
  ('LO', 'Lombardia'),
  ('MB', 'Lombardia'),
  ('MI', 'Lombardia'),
  ('MN', 'Lombardia'),
  ('PV', 'Lombardia'),
  ('SO', 'Lombardia'),
  ('VA', 'Lombardia'),
  ('BZ', 'Trentino-Alto Adige'),
  ('TN', 'Trentino-Alto Adige'),
  ('BL', 'Veneto'),
  ('PD', 'Veneto'),
  ('RO', 'Veneto'),
  ('TV', 'Veneto'),
  ('VE', 'Veneto'),
  ('VI', 'Veneto'),
  ('VR', 'Veneto'),
  ('GO', 'Friuli-Venezia Giulia'),
  ('PN', 'Friuli-Venezia Giulia'),
  ('TS', 'Friuli-Venezia Giulia'),
  ('UD', 'Friuli-Venezia Giulia'),
  ('GE', 'Liguria'),
  ('IM', 'Liguria'),
  ('SP', 'Liguria'),
  ('SV', 'Liguria'),
  ('BO', 'Emilia-Romagna'),
  ('FC', 'Emilia-Romagna'),
  ('FE', 'Emilia-Romagna'),
  ('MO', 'Emilia-Romagna'),
  ('PC', 'Emilia-Romagna'),
  ('PR', 'Emilia-Romagna'),
  ('RA', 'Emilia-Romagna'),
  ('RE', 'Emilia-Romagna'),
  ('RN', 'Emilia-Romagna'),
  ('AR', 'Toscana'),
  ('FI', 'Toscana'),
  ('GR', 'Toscana'),
  ('LI', 'Toscana'),
  ('LU', 'Toscana'),
  ('MS', 'Toscana'),
  ('PI', 'Toscana'),
  ('PO', 'Toscana'),
  ('PT', 'Toscana'),
  ('SI', 'Toscana'),
  ('PG', 'Umbria'),
  ('TR', 'Umbria'),
  ('AN', 'Marche'),
  ('AP', 'Marche'),
  ('FM', 'Marche'),
  ('MC', 'Marche'),
  ('PU', 'Marche'),
  ('FR', 'Lazio'),
  ('LT', 'Lazio'),
  ('RI', 'Lazio'),
  ('RM', 'Lazio'),
  ('VT', 'Lazio'),
  ('AQ', 'Abruzzo'),
  ('CH', 'Abruzzo'),
  ('PE', 'Abruzzo'),
  ('TE', 'Abruzzo'),
  ('CB', 'Molise'),
  ('IS', 'Molise'),
  ('AV', 'Campania'),
  ('BN', 'Campania'),
  ('CE', 'Campania'),
  ('NA', 'Campania'),
  ('SA', 'Campania'),
  ('BA', 'Puglia'),
  ('BR', 'Puglia'),
  ('BT', 'Puglia'),
  ('FG', 'Puglia'),
  ('LE', 'Puglia'),
  ('TA', 'Puglia'),
  ('MT', 'Basilicata'),
  ('PZ', 'Basilicata'),
  ('CS', 'Calabria'),
  ('CZ', 'Calabria'),
  ('KR', 'Calabria'),
  ('RC', 'Calabria'),
  ('VV', 'Calabria'),
  ('AG', 'Sicilia'),
  ('CL', 'Sicilia'),
  ('CT', 'Sicilia'),
  ('EN', 'Sicilia'),
  ('ME', 'Sicilia'),
  ('PA', 'Sicilia'),
  ('RG', 'Sicilia'),
  ('SR', 'Sicilia'),
  ('TP', 'Sicilia'),
  ('CA', 'Sardegna'),
  ('NU', 'Sardegna'),
  ('OR', 'Sardegna'),
  ('SS', 'Sardegna'),
  ('SU', 'Sardegna')
on conflict (sigla) do update set regione = excluded.regione;

-- il pilota vede il lavoro? stessa provincia, oppure stessa regione se la richiesta è stata girata alla regione
create or replace function privato.stessa_zona(p_pilota text, p_lavoro text, p_in_regione boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select p_pilota = p_lavoro
    or (coalesce(p_in_regione, false) and exists (select 1 from privato.regioni a join privato.regioni b on a.regione = b.regione
                                                  where a.sigla = p_pilota and b.sigla = p_lavoro));
$$;
revoke all on function privato.stessa_zona(text, text, boolean) from public, anon, authenticated;

-- il lavoro va solo ai piloti che fanno quel servizio (stessa lista per cliente e pilota): prima la provincia, se lì non
-- c'è nessuno la regione, altrimenti a nessuno (il cliente lo sa, Ivan lo vede su Telegram e cerca lui un pilota).
-- Chi ha «Riprese aeree foto e video» riceve anche matrimoni, case, video per aziende ed FPV.
-- «Altro» o servizio vuoto: va a tutti. Pilota senza servizi indicati: riceve tutto (non sappiamo cosa fa).
create or replace function privato.fa_servizio(p_servizi text[], p_servizio text)
returns boolean language sql immutable as $$
  select p_servizio = any(coalesce(p_servizi, '{}'))
    or ('Riprese aeree foto e video' = any(coalesce(p_servizi, '{}'))
        and p_servizio in ('Matrimoni ed eventi', 'Immobiliare e turismo', 'Video per aziende', 'Riprese FPV'));
$$;
revoke all on function privato.fa_servizio(text[], text) from public, anon, authenticated;

create or replace function privato.pilota_adatto(p_servizi text[], p_servizio text, p_provincia text)
returns boolean language sql stable security definer set search_path = public as $$
  -- p_provincia non serve più (resta per non cambiare le chiamate)
  select coalesce(btrim(p_servizio), '') in ('', 'Altro')
    or cardinality(coalesce(p_servizi, '{}')) = 0
    or privato.fa_servizio(p_servizi, p_servizio);
$$;
revoke all on function privato.pilota_adatto(text[], text, text) from public, anon, authenticated;

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
  v_regione text;
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
  where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova and g.provincia = v_prov and coalesce(g.avviso_email, true)
    and privato.pilota_adatto(g.servizi, v_z.servizio, v_prov);

  -- in provincia nessun pilota fa quel servizio: la giro ai piloti della regione che lo fanno (e lo dico al cliente)
  if not exists (select 1 from public.pagine_pilota g
                 where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova and g.provincia = v_prov
                   and privato.pilota_adatto(g.servizi, v_z.servizio, v_prov)) then
    select regione into v_regione from privato.regioni where sigla = v_prov;
    if v_regione is not null and exists (select 1 from public.pagine_pilota g join privato.regioni rg on rg.sigla = g.provincia
                                         where rg.regione = v_regione and g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova
                                           and privato.pilota_adatto(g.servizi, v_z.servizio, g.provincia)) then
      update public.richieste_zona set in_regione = true where id = v_z.id returning * into v_z;
      select coalesce(jsonb_agg(privato.pilota_contatto(g.user_id)->>'email') filter (where privato.pilota_contatto(g.user_id)->>'email' is not null), '[]'::jsonb)
        into v_piloti
      from public.pagine_pilota g join privato.regioni rg on rg.sigla = g.provincia
      where rg.regione = v_regione and g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova and coalesce(g.avviso_email, true)
        and privato.pilota_adatto(g.servizi, v_z.servizio, g.provincia);
    else
      v_regione := null;
    end if;
  end if;

  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', v_piloti,
    'servizio', v_z.servizio, 'luogo', v_z.luogo, 'data_desiderata', v_z.data_desiderata,
    'descrizione', left(privato.senza_contatti(v_z.descrizione), 400), 'provincia', v_prov));
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'richiesta_inviata', 'a', v_email, 'nome', v_nome,
    'codice', v_z.codice, 'piloti', jsonb_array_length(v_piloti), 'provincia', v_prov, 'regione', v_regione));

  return json_build_object('codice', v_z.codice, 'piloti', jsonb_array_length(v_piloti), 'regione', v_regione);
end;
$$;
revoke all on function public.invia_richiesta_zona(text, text, text, text, text, text, date, text, numeric, numeric, text) from public;
grant execute on function public.invia_richiesta_zona(text, text, text, text, text, text, date, text, numeric, numeric, text) to anon, authenticated;

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
    where ((z.pilota_diretto is null and privato.stessa_zona(g.provincia, z.provincia, z.in_regione)) or z.pilota_diretto = v_uid)
      and (z.created_at > now() - interval '60 days'
        -- i lavori confermati restano di più, per consegnarli
        or exists (select 1 from public.offerte_zona x where x.richiesta_id = z.id and x.user_id = v_uid and x.stato = 'confermata' and x.confermata_il > now() - interval '120 days'))
      and (
        -- aperte: se non è stato escluso, la data non è passata e c'è ancora posto (o ha già offerto)
        (z.stato = 'aperta' and g.scelte_decadute < 2 and not g.escluso_trova and (z.data_desiderata is null or z.data_desiderata >= current_date)
          and (z.pilota_diretto = v_uid or privato.pilota_adatto(g.servizi, z.servizio, z.provincia))
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
    where z.id = p_richiesta and z.stato = 'aperta' and ((z.pilota_diretto is null and privato.stessa_zona(g.provincia, z.provincia, z.in_regione)) or z.pilota_diretto = v_uid)
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

-- il pilota richiesto non risponde? il cliente manda la richiesta anche agli altri piloti della provincia
create or replace function public.apri_a_tutti(p_codice text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_z public.richieste_zona; v_piloti jsonb;
begin
  update public.richieste_zona set pilota_diretto = null
    where codice = p_codice and stato = 'aperta' and pilota_diretto is not null
    returning * into v_z;
  if v_z.id is null then return false; end if;
  select coalesce(jsonb_agg(privato.pilota_contatto(g.user_id)->>'email') filter (where privato.pilota_contatto(g.user_id)->>'email' is not null), '[]'::jsonb)
    into v_piloti
  from public.pagine_pilota g
  where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova and privato.stessa_zona(g.provincia, v_z.provincia, v_z.in_regione) and coalesce(g.avviso_email, true)
    and privato.pilota_adatto(g.servizi, v_z.servizio, g.provincia)
    and not exists (select 1 from public.offerte_zona o where o.richiesta_id = v_z.id and o.user_id = g.user_id);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', v_piloti,
    'servizio', v_z.servizio, 'luogo', v_z.luogo, 'data_desiderata', v_z.data_desiderata,
    'descrizione', left(privato.senza_contatti(v_z.descrizione), 400), 'provincia', v_z.provincia));
  return true;
end;
$$;
revoke all on function public.apri_a_tutti(text) from public;
grant execute on function public.apri_a_tutti(text) to anon, authenticated;
