-- Trova un pilota, pezzo 2 di 5. Lanciali in ordine, uno alla volta (si possono rilanciare).
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

