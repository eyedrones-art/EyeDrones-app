-- EyeDrones — «📞 Parla con questo pilota»: il cliente, prima di scegliere, chiede di sentire un pilota che gli ha fatto l'offerta.
-- Il pilota con abbonamento Pilota o Pro riceve subito i contatti del cliente (e il cliente i suoi); il pilota Free
-- sblocca il contatto con una piccola cifra (prezzo qui sotto). Finché lo sblocco a pagamento è SPENTO, si sblocca per tutti
-- senza costi. Per accenderlo (dopo la P.IVA e Stripe):
--   update privato.impostazioni set valore = 'si' where chiave = 'contatto_sblocco_attivo';
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.

insert into privato.impostazioni (chiave, valore) values
  ('contatto_sblocco_attivo', 'no'),   -- 'si' = i piloti Free pagano lo sblocco del contatto
  ('contatto_sblocco_prezzo', '4.90')  -- euro
on conflict (chiave) do nothing;

create table if not exists public.contatti_richiesti (
  id uuid primary key default gen_random_uuid(),
  offerta_id uuid not null unique references public.offerte_zona(id) on delete cascade,
  richiesta_id uuid not null references public.richieste_zona(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  chiesto_il timestamptz not null default now(),
  sbloccato_il timestamptz,
  pagato_sessione text unique
);
alter table public.contatti_richiesti enable row level security; -- nessuna regola: si passa solo dalle funzioni qui sotto

-- il pilota sblocca senza pagare? (sblocco spento, oppure abbonamento Pilota/Pro)
create or replace function privato.sblocco_senza_costi(p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select valore from privato.impostazioni where chiave = 'contatto_sblocco_attivo'), 'no') <> 'si'
      or coalesce((select piano from public.profili where user_id = p_uid), 'free') in ('pilota', 'pro');
$$;
revoke all on function privato.sblocco_senza_costi(uuid) from public, anon, authenticated;

-- manda i contatti a tutti e due
create or replace function privato.scambia_contatti(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare c public.contatti_richiesti; z public.richieste_zona; p jsonb;
begin
  select * into c from public.contatti_richiesti where id = p_id;
  select * into z from public.richieste_zona where id = c.richiesta_id;
  p := privato.pilota_contatto(c.user_id);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'parla_pilota', 'a', p ->> 'email', 'servizio', z.servizio, 'luogo', z.luogo,
    'cliente_nome', z.nome, 'cliente_email', z.email, 'cliente_telefono', z.telefono));
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'parla_cliente', 'a', z.email, 'nome', z.nome, 'codice', z.codice,
    'pilota', privato.nome_breve(p ->> 'nome'), 'pilota_telefono', p ->> 'telefono', 'pilota_email', p ->> 'email_pubblica', 'pilota_slug', p ->> 'slug'));
end $$;
revoke all on function privato.scambia_contatti(uuid) from public, anon, authenticated;

-- 1) il cliente (con il suo link) chiede di parlare con il pilota di un'offerta
create or replace function public.parla_con_pilota(p_codice text, p_offerta uuid)
returns text language plpgsql volatile security definer set search_path = public as $$
declare z public.richieste_zona; o public.offerte_zona; v_id uuid;
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then raise exception 'Richiesta non trovata'; end if;
  select * into z from public.richieste_zona where codice = p_codice and stato = 'aperta';
  if not found then raise exception 'Richiesta non aperta'; end if;
  select * into o from public.offerte_zona where id = p_offerta and richiesta_id = z.id and stato = 'inviata';
  if not found then raise exception 'Offerta non disponibile'; end if;
  if exists (select 1 from public.contatti_richiesti where offerta_id = o.id) then
    return (select case when sbloccato_il is not null then 'sbloccato' else 'chiesto' end from public.contatti_richiesti where offerta_id = o.id);
  end if;
  insert into public.contatti_richiesti (offerta_id, richiesta_id, user_id) values (o.id, z.id, o.user_id) returning id into v_id;
  if privato.sblocco_senza_costi(o.user_id) then
    update public.contatti_richiesti set sbloccato_il = now() where id = v_id;
    perform privato.scambia_contatti(v_id);
    return 'sbloccato';
  end if;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'parla_da_sbloccare', 'a', privato.pilota_contatto(o.user_id) ->> 'email',
    'servizio', z.servizio, 'luogo', z.luogo,
    'prezzo', coalesce((select valore from privato.impostazioni where chiave = 'contatto_sblocco_prezzo'), '4.90')));
  return 'chiesto';
end $$;
revoke all on function public.parla_con_pilota(text, uuid) from public;
grant execute on function public.parla_con_pilota(text, uuid) to anon, authenticated;

-- 2) per il cliente: a chi ha chiesto di parlare e, se sbloccato, i contatti del pilota (id offerta → stato e contatti)
create or replace function public.parla_cliente(p_codice text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then return '{}'::jsonb; end if;
  return coalesce((
    select jsonb_object_agg(c.offerta_id, jsonb_build_object(
      'stato', case when c.sbloccato_il is not null then 'sbloccato' else 'chiesto' end,
      'contatti', case when c.sbloccato_il is not null then privato.pilota_contatto(c.user_id) - 'email' end))
    from public.contatti_richiesti c join public.richieste_zona z on z.id = c.richiesta_id
    where z.codice = p_codice
  ), '{}'::jsonb);
end $$;
revoke all on function public.parla_cliente(text) from public;
grant execute on function public.parla_cliente(text) to anon, authenticated;

-- 3) per il pilota: i clienti che vogliono parlargli (id richiesta → stato, contatti se sbloccato, prezzo dello sblocco)
create or replace function public.parla_pilota()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return '{}'::jsonb; end if;
  return coalesce((
    select jsonb_object_agg(c.richiesta_id, jsonb_build_object(
      'stato', case when c.sbloccato_il is not null then 'sbloccato' else 'chiesto' end,
      'senza_costi', privato.sblocco_senza_costi(v_uid),
      'prezzo', coalesce((select valore from privato.impostazioni where chiave = 'contatto_sblocco_prezzo'), '4.90'),
      'cliente', case when c.sbloccato_il is not null then jsonb_build_object('nome', z.nome, 'email', z.email, 'telefono', z.telefono) end))
    from public.contatti_richiesti c join public.richieste_zona z on z.id = c.richiesta_id
    where c.user_id = v_uid
  ), '{}'::jsonb);
end $$;
revoke all on function public.parla_pilota() from public;
grant execute on function public.parla_pilota() to authenticated;

-- 4) il pilota sblocca il contatto (senza costi se ha l'abbonamento o se lo sblocco è spento; altrimenti serve il pagamento)
create or replace function public.sblocca_contatto(p_richiesta uuid)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c public.contatti_richiesti;
begin
  if v_uid is null then raise exception 'accesso richiesto'; end if;
  select * into c from public.contatti_richiesti where richiesta_id = p_richiesta and user_id = v_uid;
  if not found then raise exception 'nessuna richiesta di contatto'; end if;
  if c.sbloccato_il is not null then return true; end if;
  if not privato.sblocco_senza_costi(v_uid) then raise exception 'serve il pagamento'; end if;
  update public.contatti_richiesti set sbloccato_il = now() where id = c.id;
  perform privato.scambia_contatti(c.id);
  return true;
end $$;
revoke all on function public.sblocca_contatto(uuid) from public;
grant execute on function public.sblocca_contatto(uuid) to authenticated;

notify pgrst, 'reload schema';
