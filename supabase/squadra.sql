-- EYEDRONES — «👥 Squadra»: due piloti con due partite IVA lavorano sugli stessi lavori, come un'azienda.
-- Il titolare (con il Pro, o durante il lancio) invita un collega per email da «Collaboratori». Il collega apre il link,
-- entra con il suo account e accetta. Da quel momento tutti e due vedono e modificano gli stessi:
--   richieste di preventivo, preventivi, clienti, piani di volo.
-- Restano personali: registro voli, droni, batterie, attestati, permessi, documenti e fatture.
-- Le email per il pilota (richieste, lavori scelti, messaggi dei clienti, pagamenti) arrivano anche al collega.
-- Un collega per squadra (incluso nel Pro). Chiunque dei due può sciogliere la squadra quando vuole.
-- Serve aver già eseguito trova-pilota.sql e avviso-richieste-email.sql. Da eseguire una volta: SQL Editor → Run.
-- Si può rieseguire.

-- 1) la squadra: chi invita, l'email invitata, chi ha accettato
create table if not exists public.squadra (
  id uuid primary key default gen_random_uuid(),
  titolare uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text not null,
  membro uuid references auth.users (id) on delete cascade,
  codice text not null unique default replace(gen_random_uuid()::text, '-', ''),
  stato text not null default 'invitato' check (stato in ('invitato', 'attivo')),
  creato_il timestamptz not null default now(),
  accettato_il timestamptz
);
create unique index if not exists squadra_un_titolare on public.squadra (titolare);
create unique index if not exists squadra_un_membro on public.squadra (membro) where membro is not null;
alter table public.squadra enable row level security;
revoke all on public.squadra from anon, authenticated;
-- si legge e si cambia solo con le funzioni qui sotto (il codice dell'invito non esce mai dall'email)

-- 2) il compagno di squadra di un pilota (null se non è in squadra)
create or replace function privato.compagno(p_uid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select case when s.titolare = p_uid then s.membro else s.titolare end
  from public.squadra s
  where s.stato = 'attivo' and (s.titolare = p_uid or s.membro = p_uid)
  limit 1;
$$;
revoke all on function privato.compagno(uuid) from public, anon, authenticated;

-- 3) per le regole di accesso: questa riga è mia o del mio compagno di squadra?
create or replace function public.squadra_vede(p_owner uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_owner is not null and auth.uid() is not null
    and (p_owner = auth.uid() or privato.compagno(auth.uid()) = p_owner);
$$;
revoke all on function public.squadra_vede(uuid) from public, anon;
grant execute on function public.squadra_vede(uuid) to authenticated;

-- 4) le regole in più: il compagno vede e modifica (non cancella) richieste, preventivi, clienti e piani di volo.
--    Si aggiungono a quelle che ci sono già (ognuno continua a vedere le sue cose come prima).
do $$
declare t text;
begin
  foreach t in array array['richieste_preventivo', 'preventivi', 'clienti', 'piani_volo'] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists "squadra_vede" on public.%I', t);
    execute format('drop policy if exists "squadra_modifica" on public.%I', t);
    execute format('create policy "squadra_vede" on public.%I for select to authenticated using (public.squadra_vede(user_id))', t);
    execute format('create policy "squadra_modifica" on public.%I for update to authenticated using (public.squadra_vede(user_id)) with check (public.squadra_vede(user_id))', t);
  end loop;
end $$;

-- 5) chi è il pilota (nome ed email) per le email della squadra
create or replace function privato.squadra_nome(p_uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(privato.pilota_contatto(p_uid) ->> 'nome', 'Un pilota');
$$;
revoke all on function privato.squadra_nome(uuid) from public, anon, authenticated;

-- 6) la mia squadra, per la pagina «Collaboratori»
create or replace function public.squadra_mia()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); s public.squadra;
begin
  if v_uid is null then return null; end if;
  select * into s from public.squadra where titolare = v_uid or membro = v_uid limit 1;
  if not found then return jsonb_build_object('ruolo', null); end if;
  if s.titolare = v_uid then
    return jsonb_build_object('ruolo', 'titolare', 'stato', s.stato, 'email', s.email,
      'collega', case when s.membro is not null then privato.squadra_nome(s.membro) end,
      'collega_id', s.membro, 'dal', coalesce(s.accettato_il, s.creato_il));
  end if;
  return jsonb_build_object('ruolo', 'membro', 'stato', s.stato, 'collega', privato.squadra_nome(s.titolare),
    'collega_id', s.titolare, 'dal', s.accettato_il);
end $$;
revoke all on function public.squadra_mia() from public, anon;
grant execute on function public.squadra_mia() to authenticated;

-- 7) il titolare invita un collega per email (serve il Pro; durante il lancio è incluso per tutti)
create or replace function public.squadra_invita(p_email text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_mia text;
  v_piano text;
  s public.squadra;
begin
  if v_uid is null then return jsonb_build_object('errore', 'Entra nell''app per invitare un collega.'); end if;
  if v_email !~ '^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$' then return jsonb_build_object('errore', 'Scrivi un''email valida.'); end if;
  select lower(email) into v_mia from auth.users where id = v_uid;
  if v_email = v_mia then return jsonb_build_object('errore', 'Questa è la tua email: scrivi quella del collega.'); end if;
  select coalesce(piano, 'free') into v_piano from public.profili where user_id = v_uid;
  if coalesce(v_piano, 'free') <> 'pro' and current_date > date '2027-01-31' then
    return jsonb_build_object('errore', 'La squadra è inclusa nel piano Pro.');
  end if;
  if exists (select 1 from public.squadra where membro = v_uid) then
    return jsonb_build_object('errore', 'Sei già nella squadra di un altro pilota: prima esci da quella.');
  end if;
  select * into s from public.squadra where titolare = v_uid;
  if found and s.stato = 'attivo' then
    return jsonb_build_object('errore', 'Hai già un collega in squadra: prima toglilo.');
  end if;
  if exists (select 1 from public.squadra x join auth.users u on u.id = x.titolare
             where x.stato = 'attivo' and lower(u.email) = v_email) then
    return jsonb_build_object('errore', 'Questo pilota ha già una sua squadra.');
  end if;
  -- un invito alla volta: se ce n'era uno in attesa, lo sostituisce (codice nuovo, il vecchio link non vale più)
  delete from public.squadra where titolare = v_uid and stato = 'invitato';
  insert into public.squadra (titolare, email) values (v_uid, v_email) returning * into s;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'squadra_invito', 'a', v_email,
    'titolare', privato.squadra_nome(v_uid), 'codice_squadra', s.codice));
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.squadra_invita(text) from public, anon;
grant execute on function public.squadra_invita(text) to authenticated;

-- 8) il collega accetta l'invito dal link dell'email (deve essere entrato con il suo account)
create or replace function public.squadra_accetta(p_codice text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); s public.squadra;
begin
  if v_uid is null then return jsonb_build_object('errore', 'Entra nell''app per accettare l''invito.'); end if;
  select * into s from public.squadra where codice = btrim(coalesce(p_codice, '')) and stato = 'invitato' for update;
  if not found then
    if exists (select 1 from public.squadra where codice = btrim(coalesce(p_codice, '')) and membro = v_uid) then
      return jsonb_build_object('ok', true, 'collega', privato.squadra_nome((select titolare from public.squadra where codice = btrim(p_codice))));
    end if;
    return jsonb_build_object('errore', 'L''invito non è più valido: chiedi al collega di mandartene uno nuovo.');
  end if;
  if s.titolare = v_uid then return jsonb_build_object('errore', 'Questo è il tuo invito: va aperto dal collega.'); end if;
  if exists (select 1 from public.squadra where stato = 'attivo' and (titolare = v_uid or membro = v_uid)) then
    return jsonb_build_object('errore', 'Sei già in una squadra: prima esci da quella.');
  end if;
  -- se il collega aveva mandato un suo invito in attesa, lo togliamo: ora è in questa squadra
  delete from public.squadra where titolare = v_uid and stato = 'invitato';
  update public.squadra set membro = v_uid, stato = 'attivo', accettato_il = now() where id = s.id;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'squadra_accettata',
    'a', privato.pilota_contatto(s.titolare) ->> 'email', 'collega', privato.squadra_nome(v_uid)));
  return jsonb_build_object('ok', true, 'collega', privato.squadra_nome(s.titolare));
end $$;
revoke all on function public.squadra_accetta(text) from public, anon;
grant execute on function public.squadra_accetta(text) to authenticated;

-- 9) sciogliere la squadra: il titolare toglie il collega (o annulla l'invito), oppure il collega esce
create or replace function public.squadra_togli()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); s public.squadra; v_altro uuid;
begin
  if v_uid is null then return jsonb_build_object('errore', 'Entra nell''app.'); end if;
  delete from public.squadra where titolare = v_uid or membro = v_uid returning * into s;
  if not found then return jsonb_build_object('ok', true); end if;
  if s.stato = 'attivo' then
    v_altro := case when s.titolare = v_uid then s.membro else s.titolare end;
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'squadra_tolta',
      'a', privato.pilota_contatto(v_altro) ->> 'email', 'collega', privato.squadra_nome(v_uid)));
  end if;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.squadra_togli() from public, anon;
grant execute on function public.squadra_togli() to authenticated;

-- 10) le email per il pilota arrivano anche al compagno di squadra: chi è il compagno di questa email?
create or replace function privato.email_compagno(p_email text)
returns text language sql stable security definer set search_path = public as $$
  select privato.pilota_contatto(privato.compagno(u.id)) ->> 'email'
  from auth.users u
  left join public.profili p on p.user_id = u.id
  where lower(btrim(coalesce(p_email, ''))) <> ''
    and (lower(u.email) = lower(btrim(p_email)) or lower(nullif(p.email, '')) = lower(btrim(p_email)))
    and privato.compagno(u.id) is not null
  limit 1;
$$;
revoke all on function privato.email_compagno(text) from public, anon, authenticated;

-- stessa funzione di trova-pilota.sql, con in più «cc»: l'email del compagno di squadra del destinatario
create or replace function privato.avvisa_lavori(p_dati jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_url text; v_segreto text; v_dati jsonb := p_dati; v_cc text;
begin
  select valore into v_url from privato.impostazioni where chiave = 'lavori_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return; end if;
  if p_dati->>'tipo' in ('richiesta_inviata', 'nuova_offerta', 'confermato', 'rinuncia', 'decaduta', 'consegnato', 'recensione', 'miei_lavori') and p_dati ? 'a' then
    v_dati := v_dati || jsonb_build_object('cliente', privato.codice_cliente(p_dati->>'a'));
  end if;
  if jsonb_typeof(p_dati->'a') = 'string' and coalesce(p_dati->>'tipo', '') not like 'squadra\_%' then
    begin
      v_cc := privato.email_compagno(p_dati->>'a');
    exception when others then v_cc := null;  -- squadra non ancora pronta: l'avviso parte lo stesso
    end;
    if v_cc is not null and lower(v_cc) <> lower(p_dati->>'a') then v_dati := v_dati || jsonb_build_object('cc', v_cc); end if;
  end if;
  perform net.http_post(url := v_url, body := v_dati,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 8000);
exception when others then
  raise warning 'avviso lavori non inviato: %', sqlerrm;
end; $$;
revoke all on function privato.avvisa_lavori(jsonb) from public, anon, authenticated;

-- 11) richiesta di preventivo dalla pagina pubblica: la stessa email arriva anche al compagno di squadra
create or replace function public.avvisa_richiesta_squadra()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_url text; v_segreto text; v_compagno uuid; v_email text; v_nome text;
begin
  v_compagno := privato.compagno(new.user_id);
  if v_compagno is null then return new; end if;
  v_email := privato.pilota_contatto(v_compagno) ->> 'email';
  v_nome := privato.squadra_nome(v_compagno);
  if v_email is null then return new; end if;
  select valore into v_url from privato.impostazioni where chiave = 'avviso_url';
  select valore into v_segreto from privato.impostazioni where chiave = 'avviso_segreto';
  if v_url is null or v_segreto is null then return new; end if;
  perform net.http_post(url := v_url,
    body := jsonb_build_object('pilota_email', v_email, 'pilota_nome', v_nome, 'squadra_di', privato.squadra_nome(new.user_id),
      'nome', new.nome, 'email', new.email, 'telefono', new.telefono, 'servizio', new.servizio, 'luogo', new.luogo,
      'data_desiderata', new.data_desiderata, 'descrizione', new.descrizione),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-eyedrones-segreto', v_segreto),
    timeout_milliseconds := 8000);
  return new;
exception when others then
  raise warning 'avviso squadra non inviato: %', sqlerrm;
  return new;
end $$;
revoke all on function public.avvisa_richiesta_squadra() from public, anon, authenticated;

drop trigger if exists richieste_preventivo_squadra on public.richieste_preventivo;
create trigger richieste_preventivo_squadra
  after insert on public.richieste_preventivo
  for each row execute function public.avvisa_richiesta_squadra();

select 'Squadra attiva' as fatto;
