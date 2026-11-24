-- EyeDrones — «❓ Chiedi un dettaglio al cliente»: prima di fare l'offerta un pilota può fare una domanda sulla richiesta.
-- Il cliente riceve l'email e risponde dalla sua pagina delle offerte; domanda e risposta le vedono tutti i piloti
-- che vedono la richiesta (così nessuno chiede due volte la stessa cosa). Numeri, email e siti vengono tolti dai testi.
-- Da eseguire una volta, DOPO richieste-estese.sql: SQL Editor → New query → incolla tutto → Run.

create table if not exists public.domande_richiesta (
  id uuid primary key default gen_random_uuid(),
  richiesta_id uuid not null references public.richieste_zona(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  domanda text not null,
  risposta text,
  creata timestamptz not null default now(),
  risposta_il timestamptz
);
create index if not exists domande_richiesta_idx on public.domande_richiesta (richiesta_id, creata);
alter table public.domande_richiesta enable row level security; -- nessuna regola: si passa solo dalle funzioni qui sotto

-- il pilota vede questa richiesta? (provincia sua, oppure estesa)
create or replace function privato.pilota_vede_richiesta(p_uid uuid, p_richiesta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.richieste_zona z
    join public.pagine_pilota g on g.user_id = p_uid and g.attiva and g.scelte_decadute < 2 and not g.escluso_trova
    where z.id = p_richiesta and z.stato = 'aperta'
      and (((to_jsonb(z) ->> 'pilota_diretto') is null and z.provincia = g.provincia)
           or (to_jsonb(z) ->> 'pilota_diretto') = p_uid::text)
  ) or privato.vede_estesa(p_uid, p_richiesta);
$$;
revoke all on function privato.pilota_vede_richiesta(uuid, uuid) from public, anon, authenticated;

-- 1) il pilota fa la domanda (al massimo 2 per richiesta)
create or replace function public.chiedi_dettaglio(p_richiesta uuid, p_domanda text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_z public.richieste_zona; v_testo text;
begin
  if v_uid is null then raise exception 'accesso richiesto'; end if;
  v_testo := left(btrim(privato.senza_contatti(coalesce(p_domanda, ''))), 400);
  if length(v_testo) < 5 then raise exception 'domanda troppo corta'; end if;
  if not privato.pilota_vede_richiesta(v_uid, p_richiesta) then raise exception 'richiesta non disponibile'; end if;
  if (select count(*) from public.domande_richiesta where richiesta_id = p_richiesta and user_id = v_uid) >= 2 then
    raise exception 'troppe domande';
  end if;
  select * into v_z from public.richieste_zona where id = p_richiesta;
  insert into public.domande_richiesta (richiesta_id, user_id, domanda) values (p_richiesta, v_uid, v_testo);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'domanda_pilota', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
    'servizio', v_z.servizio, 'domanda', v_testo));
  return true;
end $$;
revoke all on function public.chiedi_dettaglio(uuid, text) from public;
grant execute on function public.chiedi_dettaglio(uuid, text) to authenticated;

-- 2) per il pilota: domande e risposte delle richieste che vede (id richiesta → elenco)
create or replace function public.domande_per_lavori(p_ids uuid[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return '{}'::jsonb; end if;
  return coalesce((
    select jsonb_object_agg(richiesta_id, elenco) from (
      select d.richiesta_id, jsonb_agg(jsonb_build_object('domanda', d.domanda, 'risposta', d.risposta, 'mia', d.user_id = v_uid, 'quando', d.creata) order by d.creata) as elenco
      from public.domande_richiesta d
      where d.richiesta_id = any (coalesce(p_ids, '{}')) and (privato.pilota_vede_richiesta(v_uid, d.richiesta_id)
             or exists (select 1 from public.offerte_zona o where o.richiesta_id = d.richiesta_id and o.user_id = v_uid))
      group by d.richiesta_id
    ) x
  ), '{}'::jsonb);
end $$;
revoke all on function public.domande_per_lavori(uuid[]) from public;
grant execute on function public.domande_per_lavori(uuid[]) to authenticated;

-- 3) per il cliente (con il suo link privato): le domande arrivate
create or replace function public.domande_cliente(p_codice text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', d.id, 'domanda', d.domanda, 'risposta', d.risposta, 'quando', d.creata) order by d.creata)
    from public.domande_richiesta d join public.richieste_zona z on z.id = d.richiesta_id
    where z.codice = p_codice
  ), '[]'::jsonb);
end $$;
revoke all on function public.domande_cliente(text) from public;
grant execute on function public.domande_cliente(text) to anon, authenticated;

-- 4) il cliente risponde: la risposta la vedono tutti i piloti, chi ha chiesto riceve anche l'email
create or replace function public.rispondi_domanda(p_codice text, p_domanda uuid, p_risposta text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_d public.domande_richiesta; v_z public.richieste_zona; v_testo text;
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then raise exception 'Richiesta non trovata'; end if;
  v_testo := left(btrim(privato.senza_contatti(coalesce(p_risposta, ''))), 800);
  if length(v_testo) < 1 then raise exception 'risposta vuota'; end if;
  select z.* into v_z from public.richieste_zona z where z.codice = p_codice;
  if not found then raise exception 'Richiesta non trovata'; end if;
  update public.domande_richiesta set risposta = v_testo, risposta_il = now()
    where id = p_domanda and richiesta_id = v_z.id
    returning * into v_d;
  if not found then raise exception 'Domanda non trovata'; end if;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'risposta_cliente', 'a', privato.pilota_contatto(v_d.user_id) ->> 'email',
    'servizio', v_z.servizio, 'luogo', v_z.luogo, 'domanda', v_d.domanda, 'risposta', v_testo));
  return true;
end $$;
revoke all on function public.rispondi_domanda(text, uuid, text) from public;
grant execute on function public.rispondi_domanda(text, uuid, text) to anon, authenticated;

notify pgrst, 'reload schema';
