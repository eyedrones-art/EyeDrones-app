-- EyeDrones — «Trova un pilota»: annullare o spostare un lavoro GIÀ CONFERMATO (pilota o cliente)
-- Serve trova-pilota.sql (e lavori-per-servizio.sql) già eseguiti.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
--
-- Come funziona
-- • «Sposta la data» (pilota o cliente): il lavoro resta, cambia solo la data; l'altro riceve un'email.
-- • Il PILOTA annulla (con il motivo): il cliente torna a scegliere tra le altre offerte, che tornano disponibili.
--   La commissione già pagata non si restituisce. Con 2 annullamenti in 6 mesi il pilota non riceve più richieste
--   (escluso_trova; per riammetterlo: update public.pagine_pilota set escluso_trova = false where slug = '...').
-- • Il CLIENTE annulla (con il motivo): la richiesta si chiude. Se il pilota aveva pagato la commissione, gli resta
--   come CREDITO per il prossimo lavoro (non come soldi), dato solo dopo il controllo qui sotto.
-- • Il controllo: 2 giorni dopo la data del lavoro (senza data: 2 giorni dopo l'annullamento) chiediamo al cliente
--   «il lavoro è stato fatto lo stesso?». Se risponde sì, il pilota è escluso e perde il credito.

-- 1) colonne nuove
alter table public.offerte_zona add column if not exists annullata_da text check (annullata_da in ('pilota', 'cliente'));
alter table public.offerte_zona add column if not exists annullata_il timestamptz;
alter table public.offerte_zona add column if not exists motivo_annullo text;
alter table public.offerte_zona add column if not exists controllo_chiesto timestamptz;  -- email «fatto lo stesso?» mandata
alter table public.offerte_zona add column if not exists fatto_lo_stesso boolean;        -- risposta del cliente
alter table public.offerte_zona add column if not exists credito_dato numeric(10,2);     -- commissione tornata come credito
alter table public.pagine_pilota add column if not exists credito_commissioni numeric(10,2) not null default 0;

-- 2) sposta la data (pilota o cliente): solo lavori confermati, data tra oggi e un anno
create or replace function privato.sposta_data(p_offerta uuid, p_data date, p_chi text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_o public.offerte_zona; v_z public.richieste_zona; v_p jsonb;
begin
  if p_data is null or p_data < current_date or p_data > current_date + 365 then raise exception 'data non valida'; end if;
  select * into v_o from public.offerte_zona where id = p_offerta and stato = 'confermata' for update;
  if not found then raise exception 'lavoro non trovato'; end if;
  select * into v_z from public.richieste_zona where id = v_o.richiesta_id for update;
  if v_z.data_desiderata is not distinct from p_data then return true; end if;
  update public.richieste_zona set data_desiderata = p_data where id = v_z.id;
  update public.richieste_preventivo set data_desiderata = p_data where user_id = v_o.user_id and da_zona = v_z.id;
  -- la richiesta di stelle e il controllo partono dalla data nuova
  update public.offerte_zona set recensione_chiesta = null where id = v_o.id and stelle is null and consegnata_il is null;
  v_p := privato.pilota_contatto(v_o.user_id);
  if p_chi = 'pilota' then
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'data_spostata', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
      'chi', 'pilota', 'pilota', v_p->>'nome', 'servizio', v_z.servizio, 'data_desiderata', p_data, 'data_prima', v_z.data_desiderata));
  else
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'data_spostata', 'a', v_p->>'email', 'chi', 'cliente',
      'nome', v_z.nome, 'servizio', v_z.servizio, 'luogo', v_z.luogo, 'data_desiderata', p_data, 'data_prima', v_z.data_desiderata));
  end if;
  return true;
end; $$;
revoke all on function privato.sposta_data(uuid, date, text) from public, anon, authenticated;

create or replace function public.sposta_data_pilota(p_offerta uuid, p_data date)
returns boolean language plpgsql volatile security definer set search_path = public as $$
begin
  if not exists (select 1 from public.offerte_zona where id = p_offerta and user_id = auth.uid()) then raise exception 'lavoro non trovato'; end if;
  return privato.sposta_data(p_offerta, p_data, 'pilota');
end; $$;
revoke all on function public.sposta_data_pilota(uuid, date) from public;
grant execute on function public.sposta_data_pilota(uuid, date) to authenticated;

create or replace function public.sposta_data_cliente(p_codice text, p_data date)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_off uuid;
begin
  select z.offerta_scelta into v_off from public.richieste_zona z where z.codice = p_codice and z.stato = 'confermata';
  if v_off is null then raise exception 'lavoro non trovato'; end if;
  return privato.sposta_data(v_off, p_data, 'cliente');
end; $$;
revoke all on function public.sposta_data_cliente(text, date) from public;
grant execute on function public.sposta_data_cliente(text, date) to anon, authenticated;

-- 3) il PILOTA annulla un lavoro confermato
create or replace function public.annulla_lavoro_pilota(p_offerta uuid, p_motivo text)
returns json language plpgsql volatile security definer set search_path = public as $$
declare v_o public.offerte_zona; v_z public.richieste_zona; v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), ''); v_n int;
begin
  select * into v_o from public.offerte_zona where id = p_offerta and user_id = auth.uid() and stato = 'confermata' for update;
  if not found then raise exception 'lavoro non trovato'; end if;
  if v_motivo is null then raise exception 'motivo mancante'; end if;
  if v_o.consegnata_il is not null then raise exception 'lavoro già consegnato'; end if;
  select * into v_z from public.richieste_zona where id = v_o.richiesta_id for update;
  update public.offerte_zona set stato = 'annullata', annullata_da = 'pilota', annullata_il = now(),
    motivo_annullo = privato.senza_contatti(v_motivo) where id = v_o.id;
  -- il cliente torna a scegliere: le altre offerte (messe da parte alla conferma) tornano disponibili
  update public.offerte_zona set stato = 'inviata' where richiesta_id = v_z.id and stato = 'non_scelta';
  update public.richieste_zona set stato = 'aperta', offerta_scelta = null, scelta_il = null where id = v_z.id;
  -- 2 annullamenti in 6 mesi: niente più richieste
  select count(*) into v_n from public.offerte_zona
    where user_id = v_o.user_id and annullata_da = 'pilota' and annullata_il > now() - interval '180 days';
  if v_n >= 2 then update public.pagine_pilota set escluso_trova = true where user_id = v_o.user_id; end if;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'annullato_pilota', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
    'pilota', privato.pilota_contatto(v_o.user_id)->>'nome', 'servizio', v_z.servizio, 'motivo', privato.senza_contatti(v_motivo),
    'altre', (select count(*) from public.offerte_zona where richiesta_id = v_z.id and stato = 'inviata')));
  return json_build_object('annullato', true, 'annullamenti_6_mesi', v_n, 'escluso', v_n >= 2);
end; $$;
revoke all on function public.annulla_lavoro_pilota(uuid, text) from public;
grant execute on function public.annulla_lavoro_pilota(uuid, text) to authenticated;

-- 4) il CLIENTE annulla un lavoro confermato
create or replace function public.annulla_lavoro_cliente(p_codice text, p_motivo text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_z public.richieste_zona; v_o public.offerte_zona; v_motivo text := nullif(left(btrim(coalesce(p_motivo, '')), 300), '');
begin
  select * into v_z from public.richieste_zona where codice = p_codice and stato = 'confermata' for update;
  if not found then raise exception 'lavoro non trovato'; end if;
  if v_motivo is null then raise exception 'motivo mancante'; end if;
  select * into v_o from public.offerte_zona where id = v_z.offerta_scelta and stato = 'confermata' for update;
  if not found then raise exception 'lavoro non trovato'; end if;
  if v_o.consegnata_il is not null then raise exception 'lavoro già consegnato'; end if;
  update public.offerte_zona set stato = 'annullata', annullata_da = 'cliente', annullata_il = now(),
    motivo_annullo = privato.senza_contatti(v_motivo) where id = v_o.id;
  update public.richieste_zona set stato = 'chiusa' where id = v_z.id;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'annullato_cliente', 'a', privato.pilota_contatto(v_o.user_id)->>'email',
    'pilota', privato.pilota_contatto(v_o.user_id)->>'nome', 'nome', v_z.nome, 'servizio', v_z.servizio, 'luogo', v_z.luogo,
    'data_desiderata', v_z.data_desiderata, 'motivo', privato.senza_contatti(v_motivo),
    'credito', case when v_o.pagata_sessione is not null and coalesce(v_o.commissione, 0) > 0 then v_o.commissione end));
  return true;
end; $$;
revoke all on function public.annulla_lavoro_cliente(text, text) from public;
grant execute on function public.annulla_lavoro_cliente(text, text) to anon, authenticated;

-- 5) il cliente risponde al controllo: «il lavoro è stato fatto lo stesso?»
create or replace function public.segnala_fatto_lo_stesso(p_codice text, p_offerta uuid, p_si boolean)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_o public.offerte_zona;
begin
  select o.* into v_o from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
    where o.id = p_offerta and z.codice = p_codice and o.stato = 'annullata' and o.fatto_lo_stesso is null
    for update of o;
  if not found then return false; end if;
  update public.offerte_zona set fatto_lo_stesso = p_si where id = v_o.id;
  if p_si then
    update public.pagine_pilota set escluso_trova = true,
      credito_commissioni = greatest(credito_commissioni - coalesce(v_o.credito_dato, 0), 0)
      where user_id = v_o.user_id;
    update public.offerte_zona set credito_dato = null where id = v_o.id;
  end if;
  return true;
end; $$;
revoke all on function public.segnala_fatto_lo_stesso(text, uuid, boolean) from public;
grant execute on function public.segnala_fatto_lo_stesso(text, uuid, boolean) to anon, authenticated;

-- 6) per la pagina delle offerte del cliente: i lavori annullati, con la domanda del controllo
create or replace function public.annullamenti_cliente(p_codice text)
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object(
    'id', o.id, 'da', o.annullata_da, 'motivo', o.motivo_annullo, 'il', o.annullata_il,
    'nome', coalesce(nullif(g.nome, ''), p.azienda_nome, 'Pilota'),
    -- la domanda compare quando è passata la data del lavoro (o 2 giorni dall'annullamento)
    'chiedi', o.fatto_lo_stesso is null and current_date >= coalesce(z.data_desiderata, (o.annullata_il + interval '2 days')::date),
    'risposta', o.fatto_lo_stesso
  ) order by o.annullata_il desc), '[]'::json)
  from public.offerte_zona o
  join public.richieste_zona z on z.id = o.richiesta_id
  left join public.pagine_pilota g on g.user_id = o.user_id
  left join public.profili p on p.user_id = o.user_id
  where z.codice = p_codice and o.stato = 'annullata';
$$;
revoke all on function public.annullamenti_cliente(text) from public;
grant execute on function public.annullamenti_cliente(text) to anon, authenticated;

-- 7) per il pilota: il credito e i suoi annullamenti
create or replace function public.annullamenti_pilota()
returns json language sql stable security definer set search_path = public as $$
  select json_build_object(
    'credito', coalesce((select credito_commissioni from public.pagine_pilota where user_id = auth.uid()), 0),
    'annullati_da_me_6_mesi', (select count(*) from public.offerte_zona where user_id = auth.uid() and annullata_da = 'pilota' and annullata_il > now() - interval '180 days'),
    'lavori', coalesce((select json_agg(json_build_object('offerta', o.id, 'richiesta', o.richiesta_id, 'da', o.annullata_da,
        'motivo', o.motivo_annullo, 'il', o.annullata_il, 'credito', o.credito_dato) order by o.annullata_il desc)
      from public.offerte_zona o where o.user_id = auth.uid() and o.stato = 'annullata'), '[]'::json));
$$;
revoke all on function public.annullamenti_pilota() from public;
grant execute on function public.annullamenti_pilota() to authenticated;

-- 8) ogni ora: il controllo dopo la data (email al cliente) e il credito al pilota per gli annullamenti del cliente
create or replace function privato.controlla_annullati()
returns void language plpgsql security definer set search_path = public as $$
declare r record;
begin
  for r in
    select o.id, o.user_id, o.annullata_da, o.commissione, o.pagata_sessione, z.email, z.nome, z.codice, z.servizio
    from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
    where o.stato = 'annullata' and o.controllo_chiesto is null
      and coalesce(z.data_desiderata + 2, (o.annullata_il + interval '2 days')::date) <= current_date
    for update of o skip locked
  loop
    update public.offerte_zona set controllo_chiesto = now() where id = r.id;
    -- il credito: solo se ha annullato il cliente, la commissione era pagata e nessuno ha detto «fatto lo stesso»
    if r.annullata_da = 'cliente' and r.pagata_sessione is not null and coalesce(r.commissione, 0) > 0 then
      update public.offerte_zona set credito_dato = r.commissione where id = r.id and fatto_lo_stesso is not true;
      if found then update public.pagine_pilota set credito_commissioni = credito_commissioni + r.commissione where user_id = r.user_id; end if;
    end if;
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'controllo_annullato', 'a', r.email, 'nome', r.nome, 'codice', r.codice,
      'pilota', privato.pilota_contatto(r.user_id)->>'nome', 'servizio', r.servizio));
  end loop;
end; $$;
revoke all on function privato.controlla_annullati() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('eyedrones-annullati') where exists (select 1 from cron.job where jobname = 'eyedrones-annullati');
  perform cron.schedule('eyedrones-annullati', '23 9-19 * * *', 'select privato.controlla_annullati()');
exception when others then
  raise notice 'pg_cron non disponibile: il controllo dopo gli annullamenti non parte da solo';
end $$;

-- 9) la conferma usa prima il credito: se basta, il pilota conferma senza pagare
create or replace function public.conferma_lavoro_zona(p_offerta uuid)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona; v_credito numeric;
begin
  perform privato.scadi_scelte();
  select * into v_o from public.offerte_zona where id = p_offerta and user_id = auth.uid();
  if not found or v_o.stato not in ('scelta', 'confermata') then raise exception 'offerta non disponibile'; end if;
  if v_o.stato = 'confermata' then return json_build_object('confermato', true); end if;
  if coalesce(v_o.commissione, 0) > 0 then
    select credito_commissioni into v_credito from public.pagine_pilota where user_id = v_o.user_id for update;
    if coalesce(v_credito, 0) >= v_o.commissione then
      update public.pagine_pilota set credito_commissioni = credito_commissioni - v_o.commissione where user_id = v_o.user_id;
      perform privato.conferma_offerta(v_o.id, 'credito:' || v_o.id);
      return json_build_object('confermato', true, 'con_credito', v_o.commissione);
    end if;
    return json_build_object('confermato', false, 'da_pagare', v_o.commissione);
  end if;
  perform privato.conferma_offerta(v_o.id, null);
  return json_build_object('confermato', true);
end;
$$;
revoke all on function public.conferma_lavoro_zona(uuid) from public;
grant execute on function public.conferma_lavoro_zona(uuid) to authenticated;

-- i numeri: annullamenti degli ultimi 90 giorni
-- select annullata_da, count(*), count(*) filter (where fatto_lo_stesso) as fatti_lo_stesso
--   from public.offerte_zona where annullata_il > now() - interval '90 days' group by 1;
