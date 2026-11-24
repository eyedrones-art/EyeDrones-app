-- EyeDrones — «Lavori già aperti nella tua zona»: un pilota attiva la pagina (o cambia provincia o servizi)
-- e riceve subito un'email con le richieste di Trova un pilota ancora aperte che fanno per lui.
-- L'avviso del lavoro parte una volta sola quando arriva la richiesta: così anche chi si iscrive dopo lo sa.
-- Ogni richiesta gli arriva una volta sola. Nessun contatto del cliente: solo il lavoro.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
-- Usa privato.admin_adatto (script richieste-admin.sql).

create table if not exists privato.lavori_aperti_inviati (
  user_id uuid not null references auth.users(id) on delete cascade,
  richiesta_id uuid not null references public.richieste_zona(id) on delete cascade,
  inviato timestamptz not null default now(),
  primary key (user_id, richiesta_id)
);
revoke all on privato.lavori_aperti_inviati from public, anon, authenticated;

create or replace function privato.avvisa_lavori_aperti()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_nome text;
  v_lavori jsonb;
begin
  -- solo quando la pagina diventa attiva o cambia provincia/servizi, ed è in «Trova un pilota»
  if not (new.attiva and coalesce((to_jsonb(new) ->> 'in_elenco')::boolean, true)
          and not coalesce((to_jsonb(new) ->> 'escluso_trova')::boolean, false)
          and coalesce((to_jsonb(new) ->> 'avviso_email')::boolean, true)
          and new.provincia is not null) then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.attiva = new.attiva and old.provincia is not distinct from new.provincia
     and old.servizi is not distinct from new.servizi then
    return new;
  end if;

  with aperte as (
    select z.id, z.servizio, z.luogo, z.data_desiderata, z.created_at
    from public.richieste_zona z
    where z.stato = 'aperta' and z.provincia = new.provincia
      and (to_jsonb(z) ->> 'pilota_diretto') is null
      and z.created_at > now() - interval '60 days'
      and (z.data_desiderata is null or z.data_desiderata >= current_date)
      and (select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato <> 'decaduta') < 8
      and not exists (select 1 from public.offerte_zona x where x.richiesta_id = z.id and x.user_id = new.user_id)
      and not exists (select 1 from privato.lavori_aperti_inviati s where s.user_id = new.user_id and s.richiesta_id = z.id)
      and privato.admin_adatto(to_jsonb(new), z.servizio, new.provincia)
    order by z.created_at desc
    limit 10
  ), segnate as (
    insert into privato.lavori_aperti_inviati (user_id, richiesta_id)
    select new.user_id, a.id from aperte a
    on conflict do nothing
    returning richiesta_id
  )
  select jsonb_agg(jsonb_build_object('servizio', a.servizio, 'luogo', a.luogo, 'data_desiderata', a.data_desiderata) order by a.created_at desc)
    into v_lavori
  from aperte a where a.id in (select richiesta_id from segnate);

  if v_lavori is null or jsonb_array_length(v_lavori) = 0 then return new; end if;

  v_email := privato.pilota_contatto(new.user_id) ->> 'email';
  v_nome := privato.pilota_contatto(new.user_id) ->> 'nome';
  if v_email is null then return new; end if;

  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'lavori_aperti', 'a', v_email, 'nome', v_nome,
    'provincia', new.provincia, 'lavori', v_lavori));
  return new;
exception when others then
  raise warning 'lavori aperti non avvisati: %', sqlerrm;
  return new; -- la pagina si salva comunque
end $$;
revoke all on function privato.avvisa_lavori_aperti() from public, anon, authenticated;

drop trigger if exists avvisa_lavori_aperti on public.pagine_pilota;
create trigger avvisa_lavori_aperti
  after insert or update on public.pagine_pilota
  for each row execute function privato.avvisa_lavori_aperti();
