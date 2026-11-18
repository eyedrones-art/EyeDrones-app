-- EYEDRONES — «Trova un pilota», sistema misto:
-- 1) il cliente vede i piloti PIÙ VICINI (per distanza, anche di altre province), non solo quelli della sua provincia
-- 2) su ogni pilota può toccare «Chiedi il preventivo a lui»: la richiesta va solo a quel pilota (contatti sempre dopo la conferma)
-- 3) «Chiedi a tutti» resta la richiesta di sempre (invia_richiesta_zona), che non cambia
-- La posizione del pilota è il capoluogo della sua provincia (la città esatta non si mostra a nessuno).
-- Serve aver già eseguito trova-pilota.sql e collaborazione-fissa.sql. Da eseguire una volta: SQL Editor → Run. Si può rieseguire.

alter table public.richieste_zona add column if not exists pilota_diretto uuid references auth.users(id) on delete set null;
alter table public.richieste_zona add column if not exists lat numeric(8,3);
alter table public.richieste_zona add column if not exists lon numeric(8,3);
alter table public.richieste_zona add column if not exists lat_esatta numeric(9,5);
alter table public.richieste_zona add column if not exists lon_esatta numeric(9,5);
alter table public.richieste_zona add column if not exists budget text;

-- capoluoghi di provincia (coordinate approssimate, bastano per dire «a circa 60 km»)
create table if not exists privato.capoluoghi (sigla text primary key, lat numeric(7,4) not null, lon numeric(7,4) not null);
insert into privato.capoluoghi (sigla, lat, lon) values
('AG',37.31,13.58),('AL',44.91,8.61),('AN',43.62,13.52),('AO',45.74,7.32),('AP',42.85,13.58),('AQ',42.35,13.40),('AR',43.46,11.88),('AT',44.90,8.21),
('AV',40.91,14.79),('BA',41.12,16.87),('BG',45.70,9.67),('BI',45.57,8.05),('BL',46.14,12.22),('BN',41.13,14.78),('BO',44.49,11.34),('BR',40.64,17.94),
('BS',45.54,10.22),('BT',41.27,16.29),('BZ',46.50,11.35),('CA',39.22,9.12),('CB',41.56,14.66),('CE',41.07,14.33),('CH',42.35,14.17),('CL',37.49,14.06),
('CN',44.38,7.54),('CO',45.81,9.09),('CR',45.13,10.02),('CS',39.30,16.25),('CT',37.50,15.09),('CZ',38.91,16.59),('EN',37.57,14.28),('FC',44.22,12.04),
('FE',44.84,11.62),('FG',41.46,15.55),('FI',43.77,11.25),('FM',43.16,13.72),('FR',41.64,13.34),('GE',44.41,8.93),('GO',45.94,13.62),('GR',42.76,11.11),
('IM',43.89,8.03),('IS',41.59,14.23),('KR',39.08,17.13),('LC',45.86,9.40),('LE',40.35,18.17),('LI',43.55,10.31),('LO',45.31,9.50),('LT',41.47,12.90),
('LU',43.84,10.50),('MB',45.58,9.27),('MC',43.30,13.45),('ME',38.19,15.55),('MI',45.46,9.19),('MN',45.16,10.79),('MO',44.65,10.93),('MS',44.04,10.14),
('MT',40.67,16.60),('NA',40.85,14.27),('NO',45.45,8.62),('NU',40.32,9.33),('OR',39.90,8.59),('PA',38.12,13.36),('PC',45.05,9.69),('PD',45.41,11.88),
('PE',42.46,14.21),('PG',43.11,12.39),('PI',43.72,10.40),('PN',45.96,12.66),('PO',43.88,11.10),('PR',44.80,10.33),('PT',43.93,10.92),('PU',43.91,12.91),
('PV',45.19,9.16),('PZ',40.64,15.80),('RA',44.42,12.20),('RC',38.11,15.65),('RE',44.70,10.63),('RG',36.93,14.73),('RI',42.40,12.86),('RM',41.90,12.50),
('RN',44.06,12.57),('RO',45.07,11.79),('SA',40.68,14.77),('SI',43.32,11.33),('SO',46.17,9.87),('SP',44.10,9.82),('SR',37.08,15.29),('SS',40.73,8.56),
('SU',39.17,8.52),('SV',44.31,8.48),('TA',40.47,17.24),('TE',42.66,13.70),('TN',46.07,11.12),('TO',45.07,7.69),('TP',38.02,12.51),('TR',42.56,12.65),
('TS',45.65,13.78),('TV',45.67,12.24),('UD',46.06,13.24),('VA',45.82,8.83),('VB',45.92,8.55),('VC',45.32,8.42),('VE',45.44,12.32),('VI',45.55,11.55),
('VR',45.44,10.99),('VT',42.42,12.11),('VV',38.68,16.10)
on conflict (sigla) do update set lat = excluded.lat, lon = excluded.lon;

create or replace function privato.km_tra(lat1 numeric, lon1 numeric, lat2 numeric, lon2 numeric)
returns numeric language sql immutable as $$
  select 6371 * 2 * asin(least(1, sqrt(
    power(sin(radians((lat2 - lat1) / 2)), 2) + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians((lon2 - lon1) / 2)), 2))));
$$;

-- i piloti più vicini al cliente (dal punto scritto o, se manca, dal capoluogo della sua provincia): al massimo 8, entro 250 km
-- prima quelli che fanno il servizio chiesto, poi per distanza. Niente contatti, niente città esatta.
create or replace function public.piloti_vicini(p_provincia text, p_lat numeric default null, p_lon numeric default null, p_servizio text default null)
returns json language sql stable security definer set search_path = public as $$
  with qui as (
    select coalesce(case when p_lat between 35 and 48 then p_lat end, c.lat) as lat,
           coalesce(case when p_lon between 6 and 19 then p_lon end, c.lon) as lon
    from privato.capoluoghi c where c.sigla = upper(btrim(p_provincia))
  ), elenco as (
    select g.*, p.azienda_nome, privato.km_tra(qui.lat, qui.lon, c.lat, c.lon) as km,
           privato.pilota_adatto(g.servizi, p_servizio, g.provincia) as adatto
    from public.pagine_pilota g
    join privato.capoluoghi c on c.sigla = g.provincia
    cross join qui
    left join public.profili p on p.user_id = g.user_id
    where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova
  )
  select coalesce(json_agg(json_build_object(
      'slug', e.slug,
      'nome', privato.nome_breve(coalesce(nullif(e.nome, ''), e.azienda_nome)),
      'citta', e.citta, 'provincia', e.provincia,
      'stessa_provincia', e.provincia = upper(btrim(p_provincia)),
      'km', case when e.provincia = upper(btrim(p_provincia)) then null else greatest(5, round(e.km / 5) * 5) end,
      'raggio_km', e.raggio_km,
      'servizi', e.servizi, 'adatto', e.adatto,
      'assicurato', e.assicurato, 'registrato', coalesce(e.codice_operatore, '') <> '',
      'stelle', privato.stelle_pilota(e.user_id),
      'logo', null,
      'foto', (select json_agg(f->>'url') from (select f from jsonb_array_elements(e.portfolio) f where f->>'tipo' is distinct from 'video' limit 3) q)
    ) order by e.adatto desc, (e.provincia = upper(btrim(p_provincia))) desc, e.km), '[]'::json)
  from (select * from elenco where km <= 250 order by adatto desc, (provincia = upper(btrim(p_provincia))) desc, km limit 8) e;
$$;
revoke all on function public.piloti_vicini(text, numeric, numeric, text) from public;
grant execute on function public.piloti_vicini(text, numeric, numeric, text) to anon, authenticated;

-- «Chiedi il preventivo a lui»: la richiesta va solo a quel pilota (come «Richiedi di nuovo»)
create or replace function public.invia_richiesta_pilota(
  p_slug text, p_provincia text, p_nome text, p_email text, p_telefono text,
  p_servizio text, p_luogo text, p_data date, p_descrizione text,
  p_lat numeric default null, p_lon numeric default null, p_budget text default null
)
returns json language plpgsql volatile security definer set search_path = public as $$
declare
  v_prov text := upper(left(btrim(coalesce(p_provincia, '')), 2));
  v_nome text := left(btrim(coalesce(p_nome, '')), 80);
  v_email text := nullif(left(lower(btrim(coalesce(p_email, ''))), 120), '');
  v_tel text := nullif(left(btrim(coalesce(p_telefono, '')), 30), '');
  v_g public.pagine_pilota;
  v_z public.richieste_zona;
  v_p jsonb;
begin
  select * into v_g from public.pagine_pilota
  where slug = lower(btrim(coalesce(p_slug, ''))) and attiva and in_elenco and scelte_decadute < 2 and not escluso_trova;
  if not found then raise exception 'pilota non disponibile'; end if;
  if v_prov !~ '^[A-Z]{2}$' then raise exception 'provincia mancante'; end if;
  if length(v_nome) < 2 then raise exception 'nome mancante'; end if;
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email non valida'; end if;
  if length(btrim(coalesce(p_luogo, ''))) < 2 then raise exception 'luogo mancante'; end if;
  if length(btrim(coalesce(p_descrizione, ''))) < 15 then raise exception 'descrizione mancante'; end if;
  -- stessa persona: al massimo 3 richieste all'ora; in tutto al massimo 200 al giorno
  if (select count(*) from public.richieste_zona where created_at > now() - interval '1 hour' and email = v_email) >= 3 then raise exception 'troppe richieste'; end if;
  if (select count(*) from public.richieste_zona where created_at > now() - interval '1 day') >= 200 then raise exception 'troppe richieste'; end if;

  insert into public.richieste_zona (provincia, nome, email, telefono, servizio, luogo, data_desiderata, descrizione, lat, lon, lat_esatta, lon_esatta, budget, pilota_diretto)
  values (
    v_prov, v_nome, v_email, v_tel,
    nullif(left(btrim(coalesce(p_servizio, '')), 80), ''),
    left(btrim(p_luogo), 120),
    case when p_data >= current_date and p_data < current_date + 730 then p_data end,
    left(btrim(p_descrizione), 2000),
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lat, 3) end,
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lon, 3) end,
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lat, 5) end,
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lon, 5) end,
    case when p_budget in ('fino_300', '300_700', '700_1500', 'oltre_1500') then p_budget end,
    v_g.user_id
  )
  returning * into v_z;

  v_p := privato.pilota_contatto(v_g.user_id);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', jsonb_build_array(v_p->>'email'), 'diretto', true,
    'cliente_nome', v_z.nome, 'servizio', v_z.servizio, 'luogo', v_z.luogo, 'data_desiderata', v_z.data_desiderata,
    'descrizione', left(privato.senza_contatti(v_z.descrizione), 400), 'provincia', v_z.provincia));
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'richiesta_inviata', 'a', v_email, 'nome', v_z.nome,
    'codice', v_z.codice, 'piloti', 1, 'diretto_pilota', v_p->>'nome', 'provincia', v_z.provincia));
  return json_build_object('codice', v_z.codice, 'piloti', 1, 'diretto', privato.nome_breve(coalesce(nullif(v_g.nome, ''), v_p->>'nome')));
end $$;
revoke all on function public.invia_richiesta_pilota(text, text, text, text, text, text, text, date, text, numeric, numeric, text) from public;
grant execute on function public.invia_richiesta_pilota(text, text, text, text, text, text, text, date, text, numeric, numeric, text) to anon, authenticated;

select 'Piloti vicini e richiesta diretta attivi' as fatto;
