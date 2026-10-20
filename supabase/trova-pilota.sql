-- Eyedrones — «Trova un pilota» (app.eyedrones.it/trova-pilota): il cliente scrive cosa gli serve, i piloti della sua
-- provincia mandano un'offerta, il cliente sceglie, il pilota scelto conferma (e paga la commissione, se è accesa)
-- e solo allora i due si vedono i contatti.
-- Richiede di aver già eseguito «pagina-pilota.sql» e «avviso-richieste-email.sql» (per le email e il codice segreto).
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
--
-- Come funziona
-- 1) il cliente invia la richiesta (invia_richiesta_zona): riceve per email il link privato alle offerte
-- 2) i piloti della provincia con «La mia pagina» attiva la vedono SENZA contatti (lavori_in_zona) e mandano un'offerta
--    (invia_offerta_zona): prezzo, cosa comprende (video, foto, consegna, permessi…) e messaggio. Al massimo 8 per richiesta
-- 3) il cliente apre il link (offerte_cliente) e sceglie un'offerta (scegli_offerta)
-- 4) il pilota scelto conferma entro 48 ore (conferma_lavoro_zona). Con la commissione a 0 conferma e basta; se è accesa
--    paga con Stripe (funzione Netlify lavoro-pagamento) e la conferma arriva da stripe-webhook (conferma_lavoro_pagato)
-- 5) confermato: il pilota trova la richiesta con i contatti tra le sue richieste («Crea preventivo»), il cliente vede
--    i contatti del pilota. Se il pilota non conferma in 48 ore la scelta decade e il cliente può sceglierne un altro;
--    chi lascia decadere 2 scelte non riceve più richieste in zona
--
-- 6) «I miei lavori» (/miei-lavori): il cliente ritrova tutte le sue richieste con il link personale che riceve solo per
--    email; dai lavori confermati può «richiedere di nuovo» lo stesso pilota (la richiesta va solo a lui)
-- 7) il pilota consegna il lavoro (galleria, link o report): il cliente riceve un'email e dopo 2 giorni gli chiediamo
--    le stelle; le stelle si vedono nelle offerte, nell'elenco dei piloti e nella pagina del pilota
--
-- La commissione si cambia qui sotto, in privato.impostazioni (lavori_commissione_*): 5% del prezzo, minimo 5 €,
-- massimo 30 €. All'inizio è SPENTA (lavori_commissione_attiva = 'no'): non paga nessuno. Per accenderla:
--   update privato.impostazioni set valore = 'si' where chiave = 'lavori_commissione_attiva';

create extension if not exists pg_net;
create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;
create table if not exists privato.impostazioni (chiave text primary key, valore text not null);
revoke all on privato.impostazioni from public, anon, authenticated;

insert into privato.impostazioni (chiave, valore) values
  ('lavori_url', 'https://app.eyedrones.it/.netlify/functions/avviso-lavori'),
  ('lavori_commissione_attiva', 'no'),    -- 'si' = i piloti pagano la commissione sui lavori ottenuti
  ('lavori_commissione_percento', '5'),   -- 5 = 5% dell'offerta
  ('lavori_commissione_minimo', '5'),     -- euro
  ('lavori_commissione_massimo', '30')    -- euro
on conflict (chiave) do nothing;

-- 1) colonne nuove sulle tabelle della pagina pilota
alter table public.pagine_pilota add column if not exists in_elenco boolean not null default true;   -- compare in «Trova un pilota»
alter table public.pagine_pilota add column if not exists scelte_decadute int not null default 0;     -- scelto ma non ha confermato
alter table public.pagine_pilota add column if not exists escluso_trova boolean not null default false; -- ha preso il lavoro fuori da EyeDrones
alter table public.richieste_preventivo add column if not exists da_zona uuid;                        -- arrivata da «Trova un pilota»
create unique index if not exists richieste_preventivo_zona_idx on public.richieste_preventivo (user_id, da_zona) where da_zona is not null;

-- 2) le richieste dei clienti e le offerte dei piloti: nessuno le legge direttamente, solo tramite le funzioni qui sotto
create table if not exists public.richieste_zona (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')), -- link privato del cliente
  provincia text not null,
  nome text not null,
  email text not null,
  telefono text,
  servizio text,
  luogo text,
  data_desiderata date,
  descrizione text,
  stato text not null default 'aperta',      -- aperta | scelta | confermata | chiusa
  offerta_scelta uuid,
  scelta_il timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists richieste_zona_provincia_idx on public.richieste_zona (provincia, created_at desc);
-- il punto del lavoro, arrotondato a circa 100 m: il pilota vede dov'è e controlla le zone con il suo file D-Flight
alter table public.richieste_zona add column if not exists lat numeric(8,3);
alter table public.richieste_zona add column if not exists lon numeric(8,3);
-- il punto esatto (circa 1 m): i piloti della provincia lo vedono (non è un contatto) per controllare zone e categoria
alter table public.richieste_zona add column if not exists lat_esatta numeric(9,5);
alter table public.richieste_zona add column if not exists lon_esatta numeric(9,5);
-- quanto pensa di spendere il cliente (facoltativo): fino_300 | 300_700 | 700_1500 | oltre_1500
alter table public.richieste_zona add column if not exists budget text;
-- «Richiedi di nuovo»: la richiesta va solo al pilota con cui il cliente ha già lavorato
alter table public.richieste_zona add column if not exists pilota_diretto uuid references auth.users(id) on delete set null;
create index if not exists richieste_zona_email_idx on public.richieste_zona (email, created_at desc);
alter table public.richieste_zona enable row level security;
revoke all on public.richieste_zona from anon, authenticated;

create table if not exists public.offerte_zona (
  id uuid primary key default gen_random_uuid(),
  richiesta_id uuid not null references public.richieste_zona(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prezzo numeric(10,2) not null,
  messaggio text,
  stato text not null default 'inviata',     -- inviata | scelta | confermata | decaduta | rinunciata | non_scelta
  commissione numeric(10,2),                 -- calcolata quando il cliente sceglie
  pagata_sessione text unique,               -- sessione Stripe (niente conferme doppie)
  confermata_il timestamptz,
  created_at timestamptz not null default now(),
  unique (richiesta_id, user_id)
);
alter table public.offerte_zona add column if not exists da_rimborsare boolean not null default false; -- pagata ma non più possibile
alter table public.offerte_zona add column if not exists contatto_fuori boolean;
-- cosa comprende l'offerta, per il cliente: { video_min, foto, reel, consegna_giorni, permessi, sopralluogo }
alter table public.offerte_zona add column if not exists dettagli jsonb not null default '{}';
-- il pilota scelto dice «non posso farlo» (zona, categoria, persone…): nessuna penalità, il cliente sceglie un altro
alter table public.offerte_zona add column if not exists motivo_rinuncia text;                         -- scelta decaduta: il pilota ha contattato il cliente lo stesso?
create index if not exists offerte_zona_user_idx on public.offerte_zona (user_id, created_at desc);
-- la consegna del lavoro (link alla galleria, a Drive/WeTransfer o al report) e le stelle del cliente
alter table public.offerte_zona add column if not exists consegna jsonb;                 -- { link, nota }
alter table public.offerte_zona add column if not exists consegnata_il timestamptz;
alter table public.offerte_zona add column if not exists stelle smallint check (stelle between 1 and 5);
alter table public.offerte_zona add column if not exists recensione text;
alter table public.offerte_zona add column if not exists recensione_il timestamptz;
alter table public.offerte_zona add column if not exists recensione_chiesta timestamptz; -- email «com'è andata?» mandata
alter table public.offerte_zona enable row level security;
revoke all on public.offerte_zona from anon, authenticated;

-- «I miei lavori»: un link personale per ogni email di cliente; arriva solo per email, mai sullo schermo
create table if not exists public.clienti_zona (
  email text primary key,
  codice text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  link_inviato timestamptz,
  created_at timestamptz not null default now()
);
alter table public.clienti_zona enable row level security;
revoke all on public.clienti_zona from anon, authenticated;

-- 3) aiuti interni
-- numeri di telefono, email, siti, profili e codici di attestati scritti nei testi liberi: li nascondo finché il lavoro non è confermato
create or replace function privato.senza_contatti(t text)
returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(t, ''),
    '[^\s@]+@[^\s@]+\.[a-z]{2,}', '[email nascosta]', 'gi'),
    '(https?://)?(www\.)?[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.(it|com|net|org|eu|info|biz|me|studio|photo|video|online|site|store)\M(/\S*)?', '[sito nascosto]', 'gi'),
    '(^|\s)@[a-z0-9_.]{3,}', '\1[profilo nascosto]', 'gi'),
    -- codici di operatore e attestati (ITA…, ITA-RP-…) e numeri di attestato
    '\mITA[-\s]?(?=[-A-Za-z0-9]*[0-9])[A-Za-z0-9][-A-Za-z0-9]{5,}', '[codice nascosto]', 'g'),
    '(attestato|certificato|n\.|numero|nr\.?)\s*:?\s*(?=[-/A-Z0-9]*[0-9])[A-Z0-9][-/A-Z0-9]{5,}', '\1 [codice nascosto]', 'gi'),
    '\+?\d([\s.-]?\d){8,}', '[numero nascosto]', 'g');
$$;

-- il nome del pilota prima della conferma: «Luca R.» invece di «Luca Rossi Riprese Aeree», così non si cerca su Google
create or replace function privato.nome_breve(p_nome text)
returns text language plpgsql immutable as $$
declare v text[] := regexp_split_to_array(btrim(coalesce(p_nome, '')), '\s+');
begin
  if coalesce(array_length(v, 1), 0) = 0 or v[1] = '' then return 'Pilota'; end if;
  if array_length(v, 1) = 1 then return case when length(v[1]) > 10 then upper(left(v[1], 1)) || '.' else v[1] end; end if;
  return v[1] || ' ' || upper(left(v[array_length(v, 1)], 1)) || '.';
end; $$;

-- toglie dai testi liberi le parole del nome del pilota (tranne la prima, che resta nel nome breve)
create or replace function privato.senza_nome(t text, p_nome text)
returns text language plpgsql immutable as $$
declare w text; r text := coalesce(t, ''); v text[] := regexp_split_to_array(btrim(coalesce(p_nome, '')), '\s+');
begin
  for i in 2 .. coalesce(array_length(v, 1), 0) loop
    w := regexp_replace(v[i], '[^[:alnum:]]', '', 'g');
    if length(w) >= 3 then r := regexp_replace(r, '\m' || w || '\M', '…', 'gi'); end if;
  end loop;
  if coalesce(array_length(v, 1), 0) = 1 and length(v[1]) > 10 then r := regexp_replace(r, '\m' || regexp_replace(v[1], '[^[:alnum:]]', '', 'g') || '\M', '…', 'gi'); end if;
  return r;
end; $$;

create or replace function privato.commissione_per(p_prezzo numeric)
returns numeric language plpgsql stable as $$
declare
  v_pct numeric := coalesce((select valore::numeric from privato.impostazioni where chiave = 'lavori_commissione_percento'), 0);
  v_min numeric := coalesce((select valore::numeric from privato.impostazioni where chiave = 'lavori_commissione_minimo'), 0);
  v_max numeric := coalesce((select valore::numeric from privato.impostazioni where chiave = 'lavori_commissione_massimo'), 0);
begin
  if coalesce((select valore from privato.impostazioni where chiave = 'lavori_commissione_attiva'), 'no') <> 'si' then return 0; end if;
  if v_pct <= 0 then return 0; end if;
  return round(greatest(v_min, least(v_max, p_prezzo * v_pct / 100)), 2);
end; $$;

-- le regole della commissione, da mostrare ai piloti: { percento, minimo, massimo, attiva }
create or replace function public.regole_commissione()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'percento', coalesce((select valore::numeric from privato.impostazioni where chiave = 'lavori_commissione_percento'), 0),
    'minimo', coalesce((select valore::numeric from privato.impostazioni where chiave = 'lavori_commissione_minimo'), 0),
    'massimo', coalesce((select valore::numeric from privato.impostazioni where chiave = 'lavori_commissione_massimo'), 0),
    'attiva', coalesce((select valore from privato.impostazioni where chiave = 'lavori_commissione_attiva'), 'no') = 'si');
$$;
revoke all on function public.regole_commissione() from public;
grant execute on function public.regole_commissione() to anon, authenticated;

-- il link personale del cliente («I miei lavori»): lo crea la prima volta
create or replace function privato.codice_cliente(p_email text)
returns text language plpgsql security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v text;
begin
  if v_email = '' then return null; end if;
  insert into public.clienti_zona (email) values (v_email) on conflict (email) do nothing;
  select codice into v from public.clienti_zona where email = v_email;
  return v;
end; $$;
revoke all on function privato.codice_cliente(text) from public, anon, authenticated;

-- manda un'email tramite la funzione Netlify avviso-lavori (se qualcosa non va, il resto continua lo stesso)
-- alle email per i clienti aggiungo il loro link «I miei lavori»
create or replace function privato.avvisa_lavori(p_dati jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_segreto text; v_dati jsonb := p_dati;
begin
  select valore into v_url from privato.impostazioni where chiave = 'lavori_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;
  if p_dati->>'tipo' in ('richiesta_inviata', 'nuova_offerta', 'confermato', 'rinuncia', 'decaduta', 'consegnato', 'recensione', 'miei_lavori') and p_dati ? 'a' then
    v_dati := v_dati || jsonb_build_object('cliente', privato.codice_cliente(p_dati->>'a'));
  end if;
  perform net.http_post(url := v_url, body := v_dati,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 8000);
exception when others then
  raise warning 'avviso lavori non inviato: %', sqlerrm;
end; $$;

-- nome ed email del pilota (per le email)
create or replace function privato.pilota_contatto(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'nome', coalesce(nullif(g.nome, ''), p.azienda_nome, 'Pilota'),
    'email', coalesce(nullif(p.email, ''), u.email),
    'telefono', coalesce(nullif(g.whatsapp, ''), nullif(g.telefono, '')),
    'email_pubblica', coalesce(nullif(g.email, ''), nullif(p.email, ''), u.email),
    'slug', g.slug)
  from auth.users u
  left join public.pagine_pilota g on g.user_id = u.id
  left join public.profili p on p.user_id = u.id
  where u.id = p_uid;
$$;

-- le stelle di un pilota: { media, numero } (solo dai clienti che hanno lavorato con lui)
create or replace function privato.stelle_pilota(p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('media', round(avg(stelle)::numeric, 1), 'numero', count(*))
  from public.offerte_zona where user_id = p_uid and stelle is not null;
$$;
revoke all on function privato.stelle_pilota(uuid) from public, anon, authenticated;

-- scelte non confermate da più di 48 ore: decadono, il cliente può sceglierne un'altra (e riceve un'email)
create or replace function privato.scadi_scelte()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select z.id, z.email, z.nome, z.codice, o.id as offerta, o.user_id
    from public.richieste_zona z join public.offerte_zona o on o.id = z.offerta_scelta
    where z.stato = 'scelta' and z.scelta_il < now() - interval '48 hours'
    for update of z
  loop
    update public.offerte_zona set stato = 'decaduta' where id = r.offerta;
    update public.richieste_zona set stato = 'aperta', offerta_scelta = null, scelta_il = null where id = r.id;
    update public.pagine_pilota set scelte_decadute = scelte_decadute + 1 where user_id = r.user_id;
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'decaduta', 'a', r.email, 'nome', r.nome, 'codice', r.codice,
      'pilota', privato.nome_breve(privato.pilota_contatto(r.user_id)->>'nome')));
  end loop;
  -- «com'è andata?»: 2 giorni dopo la consegna (senza consegna: 3 giorni dopo la data, o 3 settimane dopo la conferma),
  -- solo di giorno
  if extract(hour from now() at time zone 'Europe/Rome') between 9 and 20 then
    for r in
      select o.id, z.email, z.nome, z.codice, z.servizio, o.user_id
      from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
      where o.stato = 'confermata' and o.stelle is null and o.recensione_chiesta is null
        and o.confermata_il > now() - interval '120 days'
        and ((o.consegnata_il is not null and o.consegnata_il < now() - interval '2 days')
          or (o.consegnata_il is null and o.confermata_il < now() - interval '1 day'
              and coalesce(z.data_desiderata + 3, (o.confermata_il + interval '21 days')::date) <= current_date))
      for update of o skip locked
    loop
      update public.offerte_zona set recensione_chiesta = now() where id = r.id;
      perform privato.avvisa_lavori(jsonb_build_object('tipo', 'recensione', 'a', r.email, 'nome', r.nome, 'codice', r.codice,
        'pilota', privato.pilota_contatto(r.user_id)->>'nome', 'servizio', r.servizio));
    end loop;
  end if;
  -- pulizia: dopo 90 giorni le richieste non confermate si cancellano
  delete from public.richieste_zona where created_at < now() - interval '90 days' and stato <> 'confermata';
end; $$;
revoke all on function privato.scadi_scelte() from public, anon, authenticated;

-- 4) i piloti di una provincia: solo i dati pubblici, senza contatti né indirizzo della pagina
create or replace function public.piloti_in_zona(p_provincia text)
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_agg(t.x order by t.ordine desc), '[]'::json)
  from (
    select g.aggiornata_il as ordine,
      json_build_object(
        'nome', privato.nome_breve(coalesce(nullif(g.nome, ''), p.azienda_nome)),
        'citta', g.citta,
        'servizi', g.servizi,
        'assicurato', g.assicurato,
        'registrato', coalesce(g.codice_operatore, '') <> '',
        'stelle', privato.stelle_pilota(g.user_id),
        'foto', (select json_agg(f->>'url') from (select f from jsonb_array_elements(g.portfolio) f where f->>'tipo' is distinct from 'video' limit 3) q)
      ) as x
    from public.pagine_pilota g
    left join public.profili p on p.user_id = g.user_id
    where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova and g.provincia = upper(btrim(p_provincia))
    order by g.aggiornata_il desc
    limit 30
  ) t;
$$;
revoke all on function public.piloti_in_zona(text) from public;
grant execute on function public.piloti_in_zona(text) to anon, authenticated;

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
    'sopralluogo', case when (d->>'sopralluogo') = 'true' then true end));
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

-- 12) «I miei lavori»: il cliente scrive la sua email e riceve il link personale (sullo schermo non compare niente)
create or replace function public.link_miei_lavori(p_email text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_nome text; v_ultimo timestamptz;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return true; end if;
  select nome into v_nome from public.richieste_zona where email = v_email order by created_at desc limit 1;
  if not found then return true; end if;
  perform privato.codice_cliente(v_email);
  select link_inviato into v_ultimo from public.clienti_zona where email = v_email for update;
  -- al massimo un'email ogni 10 minuti per persona, e 100 all'ora in tutto
  if v_ultimo > now() - interval '10 minutes' then return true; end if;
  if (select count(*) from public.clienti_zona where link_inviato > now() - interval '1 hour') >= 100 then return true; end if;
  update public.clienti_zona set link_inviato = now() where email = v_email;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'miei_lavori', 'a', v_email, 'nome', v_nome));
  return true;
end;
$$;
revoke all on function public.link_miei_lavori(text) from public;
grant execute on function public.link_miei_lavori(text) to anon, authenticated;

-- tutte le richieste del cliente, con il pilota dei lavori confermati (contatti, consegna, stelle)
create or replace function public.miei_lavori(p_cliente text)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from public.clienti_zona where codice = p_cliente;
  if not found then return null; end if;
  perform privato.scadi_scelte();
  return json_build_object(
    'nome', (select nome from public.richieste_zona where email = v_email order by created_at desc limit 1),
    'lavori', coalesce((
      select json_agg(json_build_object(
        'codice', z.codice, 'servizio', z.servizio, 'luogo', z.luogo, 'data_desiderata', z.data_desiderata,
        'stato', z.stato, 'created_at', z.created_at, 'diretta', z.pilota_diretto is not null,
        'offerte', (select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato not in ('decaduta', 'rinunciata')),
        'scelto', (select privato.nome_breve(privato.pilota_contatto(x.user_id)->>'nome') from public.offerte_zona x where x.id = z.offerta_scelta and z.stato = 'scelta'),
        'pilota', case when o.id is not null then json_build_object(
          'nome', coalesce(nullif(g.nome, ''), p.azienda_nome, 'Pilota'), 'logo', p.azienda_logo,
          'contatti', privato.pilota_contatto(o.user_id) - 'email',
          'disponibile', coalesce(g.attiva, false) and not coalesce(g.escluso_trova, false)) end,
        'prezzo', o.prezzo, 'consegna', o.consegna, 'consegnata_il', o.consegnata_il, 'stelle', o.stelle
      ) order by z.created_at desc)
      from public.richieste_zona z
      left join public.offerte_zona o on o.richiesta_id = z.id and o.stato = 'confermata'
      left join public.pagine_pilota g on g.user_id = o.user_id
      left join public.profili p on p.user_id = o.user_id
      where z.email = v_email
    ), '[]'::json)
  );
end;
$$;
revoke all on function public.miei_lavori(text) from public;
grant execute on function public.miei_lavori(text) to anon, authenticated;

-- «Richiedi di nuovo»: da un lavoro confermato, una nuova richiesta che arriva solo a quel pilota
create or replace function public.richiedi_di_nuovo(p_cliente text, p_lavoro text, p_servizio text, p_luogo text, p_data date, p_descrizione text, p_budget text default null)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare v_email text; v_z public.richieste_zona; v_o public.offerte_zona; v_n public.richieste_zona; v_p jsonb;
begin
  select email into v_email from public.clienti_zona where codice = p_cliente;
  if not found then raise exception 'link non valido'; end if;
  select * into v_z from public.richieste_zona where codice = p_lavoro and email = v_email and stato = 'confermata';
  if not found then raise exception 'lavoro non trovato'; end if;
  select * into v_o from public.offerte_zona where richiesta_id = v_z.id and stato = 'confermata';
  if not exists (select 1 from public.pagine_pilota g where g.user_id = v_o.user_id and g.attiva and not g.escluso_trova) then
    raise exception 'pilota non disponibile';
  end if;
  if length(btrim(coalesce(p_descrizione, ''))) < 10 and coalesce(btrim(p_servizio), '') = '' then raise exception 'descrizione mancante'; end if;
  if (select count(*) from public.richieste_zona where created_at > now() - interval '1 hour' and email = v_email) >= 3
  then raise exception 'troppe richieste'; end if;

  insert into public.richieste_zona (provincia, nome, email, telefono, servizio, luogo, data_desiderata, descrizione, budget, pilota_diretto)
  values (
    v_z.provincia, v_z.nome, v_email, v_z.telefono,
    coalesce(nullif(left(btrim(coalesce(p_servizio, '')), 80), ''), v_z.servizio),
    nullif(left(btrim(coalesce(p_luogo, '')), 120), ''),
    case when p_data >= current_date and p_data < current_date + 730 then p_data end,
    nullif(left(btrim(coalesce(p_descrizione, '')), 2000), ''),
    case when p_budget in ('fino_300', '300_700', '700_1500', 'oltre_1500') then p_budget end,
    v_o.user_id
  )
  returning * into v_n;

  v_p := privato.pilota_contatto(v_o.user_id);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', jsonb_build_array(v_p->>'email'), 'diretto', true,
    'cliente_nome', v_n.nome, 'servizio', v_n.servizio, 'luogo', v_n.luogo, 'data_desiderata', v_n.data_desiderata,
    'descrizione', left(privato.senza_contatti(v_n.descrizione), 400), 'provincia', v_n.provincia));
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'richiesta_inviata', 'a', v_email, 'nome', v_n.nome,
    'codice', v_n.codice, 'piloti', 1, 'diretto_pilota', v_p->>'nome', 'provincia', v_n.provincia));
  return json_build_object('codice', v_n.codice);
end;
$$;
revoke all on function public.richiedi_di_nuovo(text, text, text, text, date, text, text) from public;
grant execute on function public.richiedi_di_nuovo(text, text, text, text, date, text, text) to anon, authenticated;

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
  where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova and g.provincia = v_z.provincia and coalesce(g.avviso_email, true)
    and not exists (select 1 from public.offerte_zona o where o.richiesta_id = v_z.id and o.user_id = g.user_id);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', v_piloti,
    'servizio', v_z.servizio, 'luogo', v_z.luogo, 'data_desiderata', v_z.data_desiderata,
    'descrizione', left(privato.senza_contatti(v_z.descrizione), 400), 'provincia', v_z.provincia));
  return true;
end;
$$;
revoke all on function public.apri_a_tutti(text) from public;
grant execute on function public.apri_a_tutti(text) to anon, authenticated;

-- 13) il pilota consegna il lavoro: il link (galleria EyeDrones, Drive, WeTransfer, report) e una nota per il cliente
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
      'pilota', privato.pilota_contatto(v_o.user_id)->>'nome', 'servizio', v_z.servizio, 'link', v_link,
      'nota', nullif(left(btrim(coalesce(p_nota, '')), 500), '')));
  end if;
  return true;
end;
$$;
revoke all on function public.consegna_lavoro_zona(uuid, text, text) from public;
grant execute on function public.consegna_lavoro_zona(uuid, text, text) to authenticated;

-- 14) le stelle del cliente (da 1 a 5, con due righe facoltative): solo per un lavoro confermato, modificabili per 30 giorni
create or replace function public.lascia_recensione(p_codice text, p_stelle int, p_testo text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona; v_z public.richieste_zona;
begin
  if p_stelle is null or p_stelle < 1 or p_stelle > 5 then raise exception 'stelle non valide'; end if;
  select * into v_z from public.richieste_zona where codice = p_codice;
  if not found then raise exception 'richiesta non trovata'; end if;
  select * into v_o from public.offerte_zona where richiesta_id = v_z.id and stato = 'confermata' for update;
  if not found then raise exception 'lavoro non confermato'; end if;
  if not (v_o.consegnata_il is not null or v_z.data_desiderata <= current_date or v_o.confermata_il < now() - interval '7 days') then
    raise exception 'troppo presto';
  end if;
  if v_o.recensione_il is not null and v_o.recensione_il < now() - interval '30 days' then raise exception 'non più modificabile'; end if;
  -- niente stelle a sé stessi (richiesta fatta con l'email del pilota)
  if lower(v_z.email) in (select lower(coalesce(x, '')) from unnest(array[privato.pilota_contatto(v_o.user_id)->>'email', privato.pilota_contatto(v_o.user_id)->>'email_pubblica']) x) then
    raise exception 'non valida';
  end if;
  update public.offerte_zona
    set stelle = p_stelle, recensione = nullif(left(privato.senza_contatti(btrim(coalesce(p_testo, ''))), 600), ''),
        recensione_il = coalesce(recensione_il, now())
    where id = v_o.id;
  return true;
end;
$$;
revoke all on function public.lascia_recensione(text, int, text) from public;
grant execute on function public.lascia_recensione(text, int, text) to anon, authenticated;

-- le recensioni nella pagina pubblica del pilota: media, numero e le ultime con il testo (nome del cliente abbreviato)
create or replace function public.recensioni_pilota(p_slug text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'media', (privato.stelle_pilota(g.user_id)->>'media')::numeric,
    'numero', (privato.stelle_pilota(g.user_id)->>'numero')::int,
    'ultime', coalesce((
      select json_agg(json_build_object('stelle', t.stelle, 'testo', t.recensione, 'nome', t.nome, 'servizio', t.servizio, 'quando', t.recensione_il) order by t.recensione_il desc)
      from (
        select o.stelle, o.recensione, privato.nome_breve(z.nome) as nome, z.servizio, o.recensione_il
        from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
        where o.user_id = g.user_id and o.stelle is not null
        order by (o.recensione is not null) desc, o.recensione_il desc
        limit 10
      ) t
    ), '[]'::json))
  from public.pagine_pilota g
  where g.slug = lower(btrim(p_slug)) and g.attiva;
$$;
revoke all on function public.recensioni_pilota(text) from public;
grant execute on function public.recensioni_pilota(text) to anon, authenticated;

-- 11) ogni ora: le scelte non confermate in 48 ore decadono (se pg_cron c'è; altrimenti succede quando si apre la pagina)
do $$
begin
  perform cron.unschedule('eyedrones-lavori') where exists (select 1 from cron.job where jobname = 'eyedrones-lavori');
  perform cron.schedule('eyedrones-lavori', '17 * * * *', 'select privato.scadi_scelte()');
exception when others then
  raise notice 'pg_cron non disponibile: le scelte decadono quando si aprono le pagine';
end $$;

-- i numeri di «Trova un pilota» (ultimi 30 giorni)
select provincia,
  count(*) as richieste,
  count(*) filter (where stato = 'confermata') as confermate,
  (select count(*) from public.offerte_zona o where o.richiesta_id = any(array_agg(z.id))) as offerte,
  (select coalesce(sum(commissione), 0) from public.offerte_zona o where o.stato = 'confermata' and o.richiesta_id = any(array_agg(z.id))) as commissioni_euro
from public.richieste_zona z
where created_at > now() - interval '30 days'
group by 1
order by 2 desc;

-- pagamenti da rimborsare su Stripe (pagati quando il cliente aveva già scelto un altro pilota)
select o.id, o.pagata_sessione, o.commissione from public.offerte_zona o where o.da_rimborsare;

-- piloti esclusi perché hanno preso il lavoro fuori da EyeDrones (per riammetterli: update public.pagine_pilota set escluso_trova = false where slug = '...')
select g.slug, g.nome, g.scelte_decadute from public.pagine_pilota g where g.escluso_trova;
