-- EyeDrones — «Estendi la richiesta»: l'amministratore manda una richiesta di Trova un pilota anche ai piloti
-- di tutta Italia che fanno quel servizio (per esempio fotogrammetria), non solo a quelli della provincia.
-- Loro ricevono l'email «Nuovo lavoro», vedono il lavoro in «Lavori nella tua zona» (con «fuori zona») e mandano l'offerta.
-- Nessun contatto del cliente, come sempre: i contatti arrivano solo al pilota scelto, dopo la conferma.
-- Da eseguire una volta, DOPO richieste-admin.sql: SQL Editor → New query → incolla tutto → Run.

create table if not exists privato.richieste_estese (
  richiesta_id uuid primary key references public.richieste_zona(id) on delete cascade,
  estesa_il timestamptz not null default now()
);
revoke all on privato.richieste_estese from public, anon, authenticated;

-- il pilota può vedere questa richiesta estesa? (pagina attiva, fa quel servizio, richiesta ancora aperta)
create or replace function privato.vede_estesa(p_uid uuid, p_richiesta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from privato.richieste_estese e
    join public.richieste_zona z on z.id = e.richiesta_id
    join public.pagine_pilota g on g.user_id = p_uid
    where e.richiesta_id = p_richiesta and z.stato = 'aperta'
      and g.attiva and g.scelte_decadute < 2 and not g.escluso_trova
      and privato.admin_adatto(to_jsonb(g), z.servizio, g.provincia));
$$;
revoke all on function privato.vede_estesa(uuid, uuid) from public, anon, authenticated;

-- 1) per il pilota: le richieste estese fuori dalla sua provincia (quelle della sua provincia le ha già)
create or replace function public.lavori_estesi()
returns json language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_prov text;
begin
  if v_uid is null then return '[]'::json; end if;
  select provincia into v_prov from public.pagine_pilota where user_id = v_uid and attiva;
  if not found then return '[]'::json; end if;
  return coalesce((
    select json_agg(json_build_object(
      'id', z.id, 'servizio', z.servizio, 'luogo', z.luogo, 'data_desiderata', z.data_desiderata,
      'lat', coalesce((to_jsonb(z) ->> 'lat_esatta')::numeric, (to_jsonb(z) ->> 'lat')::numeric),
      'lon', coalesce((to_jsonb(z) ->> 'lon_esatta')::numeric, (to_jsonb(z) ->> 'lon')::numeric),
      'esatto', (to_jsonb(z) ->> 'lat_esatta') is not null, 'budget', to_jsonb(z) ->> 'budget',
      'descrizione', privato.senza_contatti(z.descrizione), 'created_at', z.created_at, 'stato', z.stato,
      'diretto', false, 'cliente', null, 'estesa', true, 'provincia', z.provincia,
      'offerte', (select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato <> 'decaduta'),
      'mia', (select json_build_object('id', o.id, 'prezzo', o.prezzo, 'messaggio', o.messaggio, 'dettagli', to_jsonb(o) -> 'dettagli',
                'stato', o.stato, 'commissione', o.commissione, 'scade', z.scelta_il + interval '48 hours',
                'consegna', to_jsonb(o) -> 'consegna', 'consegnata_il', to_jsonb(o) -> 'consegnata_il',
                'stelle', to_jsonb(o) -> 'stelle', 'recensione', to_jsonb(o) -> 'recensione')
              from public.offerte_zona o where o.richiesta_id = z.id and o.user_id = v_uid)
    ) order by z.created_at desc)
    from privato.richieste_estese e
    join public.richieste_zona z on z.id = e.richiesta_id
    where z.provincia is distinct from v_prov
      and (
        (privato.vede_estesa(v_uid, z.id)
          and (z.data_desiderata is null or z.data_desiderata >= current_date)
          and ((select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato <> 'decaduta') < 8
               or exists (select 1 from public.offerte_zona x where x.richiesta_id = z.id and x.user_id = v_uid)))
        or exists (select 1 from public.offerte_zona x where x.richiesta_id = z.id and x.user_id = v_uid)
      )
  ), '[]'::json);
end $$;
revoke all on function public.lavori_estesi() from public;
grant execute on function public.lavori_estesi() to authenticated;

-- 2) per il pilota: l'offerta su una richiesta estesa (stesse regole dell'offerta normale)
create or replace function public.invia_offerta_estesa(p_richiesta uuid, p_prezzo numeric, p_messaggio text, p_dettagli jsonb default '{}')
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_z public.richieste_zona; v_nuova boolean;
begin
  if v_uid is null then raise exception 'accesso richiesto'; end if;
  if p_prezzo is null or p_prezzo < 10 or p_prezzo > 100000 then raise exception 'prezzo non valido'; end if;
  if not privato.vede_estesa(v_uid, p_richiesta) then raise exception 'richiesta non disponibile'; end if;
  select * into v_z from public.richieste_zona where id = p_richiesta and stato = 'aperta' for update;
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
end $$;
revoke all on function public.invia_offerta_estesa(uuid, numeric, text, jsonb) from public;
grant execute on function public.invia_offerta_estesa(uuid, numeric, text, jsonb) to authenticated;

-- 3) per l'amministratore: estende la richiesta e avvisa i piloti di tutta Italia che fanno quel servizio
create or replace function public.estendi_richiesta_admin(p_richiesta uuid)
returns int language plpgsql volatile security definer set search_path = public as $$
declare v_z public.richieste_zona; v_piloti jsonb;
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it') then
    raise exception 'non autorizzato';
  end if;
  select * into v_z from public.richieste_zona where id = p_richiesta and stato = 'aperta';
  if not found then raise exception 'richiesta non aperta'; end if;
  insert into privato.richieste_estese (richiesta_id) values (v_z.id) on conflict do nothing;

  select coalesce(jsonb_agg(e) filter (where e is not null), '[]'::jsonb) into v_piloti
  from (
    select privato.pilota_contatto(g.user_id) ->> 'email' as e
    from public.pagine_pilota g
    where g.attiva and coalesce((to_jsonb(g) ->> 'in_elenco')::boolean, true) and g.scelte_decadute < 2 and not g.escluso_trova
      and g.provincia is distinct from v_z.provincia
      and coalesce((to_jsonb(g) ->> 'avviso_email')::boolean, true)
      and privato.admin_adatto(to_jsonb(g), v_z.servizio, g.provincia)
      and not exists (select 1 from public.offerte_zona o where o.richiesta_id = v_z.id and o.user_id = g.user_id)
    limit 30
  ) x;

  if jsonb_array_length(v_piloti) > 0 then
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', v_piloti,
      'servizio', v_z.servizio, 'luogo', v_z.luogo, 'data_desiderata', v_z.data_desiderata,
      'descrizione', left(privato.senza_contatti(v_z.descrizione), 400), 'provincia', v_z.provincia));
  end if;
  return jsonb_array_length(v_piloti);
end $$;
revoke all on function public.estendi_richiesta_admin(uuid) from public;
grant execute on function public.estendi_richiesta_admin(uuid) to authenticated;

notify pgrst, 'reload schema';
