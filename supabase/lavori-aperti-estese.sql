-- EyeDrones — «Lavori già aperti» comprende anche le richieste estese (regione o tutta Italia).
-- La logica passa in privato.manda_lavori_aperti(utente), che si può anche lanciare a mano per un pilota.
-- Da eseguire una volta, DOPO lavori-aperti-nuovi.sql e richieste-regione.sql: SQL Editor → incolla tutto → Run.

create or replace function privato.manda_lavori_aperti(p_uid uuid)
returns int language plpgsql security definer set search_path = public as $$
declare
  g public.pagine_pilota;
  v_email text; v_nome text; v_lavori jsonb;
begin
  select * into g from public.pagine_pilota where user_id = p_uid;
  if not found or not (g.attiva and coalesce((to_jsonb(g) ->> 'in_elenco')::boolean, true)
          and not coalesce((to_jsonb(g) ->> 'escluso_trova')::boolean, false)
          and coalesce((to_jsonb(g) ->> 'avviso_email')::boolean, true)
          and g.provincia is not null) then
    return 0;
  end if;

  with aperte as (
    select z.id, z.servizio, z.luogo, z.data_desiderata, z.created_at
    from public.richieste_zona z
    where z.stato = 'aperta'
      and (to_jsonb(z) ->> 'pilota_diretto') is null
      and z.created_at > now() - interval '60 days'
      and (z.data_desiderata is null or z.data_desiderata >= current_date)
      and (select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato <> 'decaduta') < 8
      and not exists (select 1 from public.offerte_zona x where x.richiesta_id = z.id and x.user_id = p_uid)
      and not exists (select 1 from privato.lavori_aperti_inviati s where s.user_id = p_uid and s.richiesta_id = z.id)
      and (
        (z.provincia = g.provincia and privato.admin_adatto(to_jsonb(g), z.servizio, g.provincia))
        or privato.vede_estesa(p_uid, z.id)
      )
    order by z.created_at desc
    limit 10
  ), segnate as (
    insert into privato.lavori_aperti_inviati (user_id, richiesta_id)
    select p_uid, a.id from aperte a
    on conflict do nothing
    returning richiesta_id
  )
  select jsonb_agg(jsonb_build_object('servizio', a.servizio, 'luogo', a.luogo, 'data_desiderata', a.data_desiderata) order by a.created_at desc)
    into v_lavori
  from aperte a where a.id in (select richiesta_id from segnate);

  if v_lavori is null or jsonb_array_length(v_lavori) = 0 then return 0; end if;
  v_email := privato.pilota_contatto(p_uid) ->> 'email';
  v_nome := privato.pilota_contatto(p_uid) ->> 'nome';
  if v_email is null then return 0; end if;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'lavori_aperti', 'a', v_email, 'nome', v_nome,
    'provincia', g.provincia, 'lavori', v_lavori));
  return jsonb_array_length(v_lavori);
end $$;
revoke all on function privato.manda_lavori_aperti(uuid) from public, anon, authenticated;

create or replace function privato.avvisa_lavori_aperti()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and old.attiva = new.attiva and old.provincia is not distinct from new.provincia
     and old.servizi is not distinct from new.servizi then
    return new;
  end if;
  perform privato.manda_lavori_aperti(new.user_id);
  return new;
exception when others then
  raise warning 'lavori aperti non avvisati: %', sqlerrm;
  return new;
end $$;
revoke all on function privato.avvisa_lavori_aperti() from public, anon, authenticated;

drop trigger if exists avvisa_lavori_aperti on public.pagine_pilota;
create trigger avvisa_lavori_aperti
  after insert or update on public.pagine_pilota
  for each row execute function privato.avvisa_lavori_aperti();
