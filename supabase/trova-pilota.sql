-- Eyedrones — «Trova un pilota» (app.eyedrones.it/trova-pilota): il cliente scrive cosa gli serve, i piloti della sua
-- provincia mandano un'offerta, il cliente sceglie, il pilota scelto conferma (e paga la commissione, se è accesa)
-- e solo allora i due si vedono i contatti.
-- Richiede di aver già eseguito «pagina-pilota.sql» e «avviso-richieste-email.sql» (per le email e il codice segreto).
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
--
-- Come funziona
-- 1) il cliente invia la richiesta (invia_richiesta_zona): riceve per email il link privato alle offerte
-- 2) i piloti della provincia con «La mia pagina» attiva la vedono SENZA contatti (lavori_in_zona) e mandano un'offerta
--    (invia_offerta_zona): prezzo e messaggio. Al massimo 8 offerte per richiesta
-- 3) il cliente apre il link (offerte_cliente) e sceglie un'offerta (scegli_offerta)
-- 4) il pilota scelto conferma entro 48 ore (conferma_lavoro_zona). Con la commissione a 0 conferma e basta; se è accesa
--    paga con Stripe (funzione Netlify lavoro-pagamento) e la conferma arriva da stripe-webhook (conferma_lavoro_pagato)
-- 5) confermato: il pilota trova la richiesta con i contatti tra le sue richieste («Crea preventivo»), il cliente vede
--    i contatti del pilota. Se il pilota non conferma in 48 ore la scelta decade e il cliente può sceglierne un altro;
--    chi lascia decadere 2 scelte non riceve più richieste in zona
--
-- La commissione si cambia qui sotto, in privato.impostazioni (lavori_commissione_*). All'inizio è 0: non paga nessuno.

create extension if not exists pg_net;
create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;
create table if not exists privato.impostazioni (chiave text primary key, valore text not null);
revoke all on privato.impostazioni from public, anon, authenticated;

insert into privato.impostazioni (chiave, valore) values
  ('lavori_url', 'https://app.eyedrones.it/.netlify/functions/avviso-lavori'),
  ('lavori_commissione_percento', '0'),   -- es. 5 = 5% dell'offerta
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
alter table public.richieste_zona enable row level security;
revoke all on public.richieste_zona from anon, authenticated;

create table if not exists public.offerte_zona (
  id uuid primary key default gen_random_uuid(),
  richiesta_id uuid not null references public.richieste_zona(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prezzo numeric(10,2) not null,
  messaggio text,
  stato text not null default 'inviata',     -- inviata | scelta | confermata | decaduta | non_scelta
  commissione numeric(10,2),                 -- calcolata quando il cliente sceglie
  pagata_sessione text unique,               -- sessione Stripe (niente conferme doppie)
  confermata_il timestamptz,
  created_at timestamptz not null default now(),
  unique (richiesta_id, user_id)
);
alter table public.offerte_zona add column if not exists da_rimborsare boolean not null default false; -- pagata ma non più possibile
alter table public.offerte_zona add column if not exists contatto_fuori boolean;                         -- scelta decaduta: il pilota ha contattato il cliente lo stesso?
create index if not exists offerte_zona_user_idx on public.offerte_zona (user_id, created_at desc);
alter table public.offerte_zona enable row level security;
revoke all on public.offerte_zona from anon, authenticated;

-- 3) aiuti interni
-- numeri di telefono, email, siti e profili scritti nei testi liberi: li nascondo finché il lavoro non è confermato
create or replace function privato.senza_contatti(t text)
returns text language sql immutable as $$
  select regexp_replace(regexp_replace(regexp_replace(regexp_replace(coalesce(t, ''),
    '[^\s@]+@[^\s@]+\.[a-z]{2,}', '[email nascosta]', 'gi'),
    '(https?://)?(www\.)?[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)*\.(it|com|net|org|eu|info|biz|me|studio|photo|video|online|site|store)\M(/\S*)?', '[sito nascosto]', 'gi'),
    '(^|\s)@[a-z0-9_.]{3,}', '\1[profilo nascosto]', 'gi'),
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
  if v_pct <= 0 then return 0; end if;
  return round(greatest(v_min, least(v_max, p_prezzo * v_pct / 100)), 2);
end; $$;

-- manda un'email tramite la funzione Netlify avviso-lavori (se qualcosa non va, il resto continua lo stesso)
create or replace function privato.avvisa_lavori(p_dati jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_segreto text;
begin
  select valore into v_url from privato.impostazioni where chiave = 'lavori_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;
  perform net.http_post(url := v_url, body := p_dati,
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
create or replace function public.invia_richiesta_zona(
  p_provincia text, p_nome text, p_email text, p_telefono text,
  p_servizio text, p_luogo text, p_data date, p_descrizione text,
  p_lat numeric default null, p_lon numeric default null
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

  insert into public.richieste_zona (provincia, nome, email, telefono, servizio, luogo, data_desiderata, descrizione, lat, lon)
  values (
    v_prov, v_nome, v_email, v_tel,
    nullif(left(btrim(coalesce(p_servizio, '')), 80), ''),
    nullif(left(btrim(coalesce(p_luogo, '')), 120), ''),
    case when p_data >= current_date and p_data < current_date + 730 then p_data end,
    nullif(left(btrim(coalesce(p_descrizione, '')), 2000), ''),
    -- solo punti in Italia (più o meno), arrotondati
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lat, 3) end,
    case when p_lat between 35 and 48 and p_lon between 6 and 19 then round(p_lon, 3) end
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
revoke all on function public.invia_richiesta_zona(text, text, text, text, text, text, date, text, numeric, numeric) from public;
grant execute on function public.invia_richiesta_zona(text, text, text, text, text, text, date, text, numeric, numeric) to anon, authenticated;

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
      'created_at', v_z.created_at),
    'offerte', coalesce((
      select json_agg(json_build_object(
        'id', o.id, 'prezzo', o.prezzo,
        'messaggio', case when o.stato = 'confermata' then o.messaggio else privato.senza_nome(privato.senza_contatti(o.messaggio), coalesce(nullif(g.nome, ''), p.azienda_nome)) end,
        'stato', o.stato, 'created_at', o.created_at,
        'pilota', json_build_object(
          -- nome completo, logo e pagina solo a lavoro confermato
          'nome', case when o.stato = 'confermata' then coalesce(nullif(g.nome, ''), p.azienda_nome, 'Pilota') else privato.nome_breve(coalesce(nullif(g.nome, ''), p.azienda_nome)) end,
          'logo', case when o.stato = 'confermata' then p.azienda_logo end, 'citta', g.citta, 'raggio_km', g.raggio_km,
          'presentazione', left(case when o.stato = 'confermata' then g.presentazione else privato.senza_nome(privato.senza_contatti(g.presentazione), coalesce(nullif(g.nome, ''), p.azienda_nome)) end, 600),
          'servizi', g.servizi, 'abilitazioni', g.abilitazioni, 'assicurato', g.assicurato,
          'registrato', coalesce(g.codice_operatore, '') <> '',
          'portfolio', (select json_agg(f->>'url') from (select f from jsonb_array_elements(g.portfolio) f where f->>'tipo' is distinct from 'video' limit 6) q),
          'contatti', case when o.stato = 'confermata' then privato.pilota_contatto(o.user_id) - 'email' end
        )) order by (o.stato = 'confermata') desc, (o.stato = 'scelta') desc, o.prezzo)
      from public.offerte_zona o
      left join public.pagine_pilota g on g.user_id = o.user_id
      left join public.profili p on p.user_id = o.user_id
      where o.richiesta_id = v_z.id and o.stato <> 'decaduta'
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
      'id', z.id, 'servizio', z.servizio, 'luogo', z.luogo, 'data_desiderata', z.data_desiderata, 'lat', z.lat, 'lon', z.lon,
      'descrizione', privato.senza_contatti(z.descrizione), 'created_at', z.created_at, 'stato', z.stato,
      'offerte', (select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato <> 'decaduta'),
      'mia', (select json_build_object('id', o.id, 'prezzo', o.prezzo, 'messaggio', o.messaggio, 'stato', o.stato,
                'commissione', o.commissione, 'scade', z.scelta_il + interval '48 hours')
              from public.offerte_zona o where o.richiesta_id = z.id and o.user_id = v_uid)
    ) order by z.created_at desc)
    from public.richieste_zona z
    join public.pagine_pilota g on g.user_id = v_uid and g.attiva and g.provincia = z.provincia
    where z.created_at > now() - interval '60 days'
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
create or replace function public.invia_offerta_zona(p_richiesta uuid, p_prezzo numeric, p_messaggio text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_uid uuid := auth.uid(); v_z public.richieste_zona; v_nuova boolean;
begin
  if v_uid is null then raise exception 'accesso richiesto'; end if;
  if p_prezzo is null or p_prezzo < 10 or p_prezzo > 100000 then raise exception 'prezzo non valido'; end if;
  select z.* into v_z from public.richieste_zona z
    join public.pagine_pilota g on g.user_id = v_uid and g.attiva and g.provincia = z.provincia and g.scelte_decadute < 2 and not g.escluso_trova
    where z.id = p_richiesta and z.stato = 'aperta'
    for update of z;
  if not found then raise exception 'richiesta non disponibile'; end if;
  v_nuova := not exists (select 1 from public.offerte_zona where richiesta_id = v_z.id and user_id = v_uid);
  if v_nuova and (select count(*) from public.offerte_zona where richiesta_id = v_z.id and stato <> 'decaduta') >= 8 then
    raise exception 'offerte al completo';
  end if;
  insert into public.offerte_zona (richiesta_id, user_id, prezzo, messaggio)
  values (v_z.id, v_uid, round(p_prezzo, 2), nullif(left(btrim(coalesce(p_messaggio, '')), 1500), ''))
  on conflict (richiesta_id, user_id) do update set prezzo = excluded.prezzo, messaggio = excluded.messaggio
    where public.offerte_zona.stato = 'inviata';
  if v_nuova then
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuova_offerta', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
      'pilota', privato.nome_breve(privato.pilota_contatto(v_uid)->>'nome'), 'prezzo', round(p_prezzo, 2), 'servizio', v_z.servizio));
  end if;
  return true;
end;
$$;
revoke all on function public.invia_offerta_zona(uuid, numeric, text) from public;
grant execute on function public.invia_offerta_zona(uuid, numeric, text) to authenticated;

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
    concat_ws(E'\n\n', v_z.descrizione, '— Lavoro confermato da «Trova un pilota»: la tua offerta era di ' || to_char(v_o.prezzo, 'FM999G999D00') || ' €.'),
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
