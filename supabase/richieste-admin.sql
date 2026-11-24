-- EyeDrones — «📍 Richieste di Trova un pilota»: la pagina che vede solo l'amministratore (Impostazioni)
-- Per ogni richiesta: cosa chiede il cliente, dove, quanti piloti sono stati avvisati, se le email e le
-- notifiche sono partite, quante offerte sono arrivate e a che prezzo.
-- Nessun nome, email o telefono di clienti o piloti: solo il lavoro e i numeri.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.

-- 1) Il registro degli avvisi: la funzione avviso-lavori ci scrive quante email e notifiche sono partite.
--    Niente indirizzi: solo tipo, provincia, servizio e i conteggi.
create table if not exists public.avvisi_inviati (
  id bigserial primary key,
  creato timestamptz not null default now(),
  tipo text not null,
  provincia text,
  servizio text,
  email_ok int not null default 0,
  email_ko int not null default 0,
  push_ok int not null default 0
);
create index if not exists avvisi_inviati_creato_idx on public.avvisi_inviati (creato desc);
alter table public.avvisi_inviati enable row level security; -- nessuna regola: si legge solo dalle funzioni qui sotto

create or replace function public.avvisi_registra(p_segreto text, p_tipo text, p_provincia text, p_servizio text,
                                                  p_email_ok int, p_email_ko int, p_push int)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  insert into public.avvisi_inviati (tipo, provincia, servizio, email_ok, email_ko, push_ok)
  values (left(p_tipo, 40), upper(left(p_provincia, 4)), left(p_servizio, 80),
          greatest(coalesce(p_email_ok, 0), 0), greatest(coalesce(p_email_ko, 0), 0), greatest(coalesce(p_push, 0), 0));
  delete from public.avvisi_inviati where creato < now() - interval '180 days';
end $$;
revoke all on function public.avvisi_registra(text, text, text, text, int, int, int) from public;
grant execute on function public.avvisi_registra(text, text, text, text, int, int, int) to anon;

-- 2) «Questo pilota fa quel servizio?»: usa la regola dell'invio se c'è (lavori-per-servizio.sql), altrimenti sì
create or replace function privato.admin_adatto(p_pagina jsonb, p_servizio text, p_provincia text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v boolean;
begin
  if to_regprocedure('privato.pilota_adatto(text[],text,text)') is null then return true; end if;
  execute 'select privato.pilota_adatto($1, $2, $3)' into v
    using array(select jsonb_array_elements_text(coalesce(p_pagina -> 'servizi', '[]'::jsonb))), p_servizio, p_provincia;
  return coalesce(v, true);
exception when others then return true;
end $$;
revoke all on function privato.admin_adatto(jsonb, text, text) from public, anon, authenticated;

-- le richieste che l'amministratore ha esteso a tutta Italia (script richieste-estese.sql)
create table if not exists privato.richieste_estese (
  richiesta_id uuid primary key references public.richieste_zona(id) on delete cascade,
  estesa_il timestamptz not null default now()
);
revoke all on privato.richieste_estese from public, anon, authenticated;

-- 3) Le ultime richieste, solo per l'amministratore
create or replace function public.richieste_admin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it') then
    return null;
  end if;

  return coalesce((
    select jsonb_agg(riga order by (riga ->> 'creata') desc)
    from (
      select jsonb_build_object(
        'id', z.id,
        'estesa', exists (select 1 from privato.richieste_estese e where e.richiesta_id = z.id),
        'creata', z.created_at,
        'provincia', z.provincia,
        'servizio', z.servizio,
        'luogo', z.luogo,
        'per_il', z.data_desiderata,
        'budget', z.budget,
        'descrizione', left(privato.senza_contatti(z.descrizione), 600),
        'stato', z.stato,
        'scelta_il', z.scelta_il,
        'in_regione', coalesce((to_jsonb(z) ->> 'in_regione')::boolean, false),
        'diretto', (to_jsonb(z) ->> 'pilota_diretto') is not null,
        -- i piloti della provincia che fanno quel servizio
        'piloti_zona', (
          select count(*) from public.pagine_pilota g
          where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova
            and g.provincia = z.provincia
            and privato.admin_adatto(to_jsonb(g), z.servizio, g.provincia)),
        -- l'avviso partito per questa richiesta (registrato pochi secondi dopo)
        'avviso', (
          select jsonb_build_object('email_ok', a.email_ok, 'email_ko', a.email_ko, 'push_ok', a.push_ok)
          from public.avvisi_inviati a
          where a.tipo = 'nuovo_lavoro' and a.provincia = upper(z.provincia)
            and a.creato between z.created_at - interval '1 minute' and z.created_at + interval '10 minutes'
          order by abs(extract(epoch from a.creato - z.created_at)) limit 1),
        'offerte', coalesce((
          select jsonb_agg(jsonb_build_object('prezzo', o.prezzo, 'stato', o.stato, 'quando', o.created_at,
                                              'messaggio', left(privato.senza_contatti(o.messaggio), 300))
                           order by o.created_at)
          from public.offerte_zona o where o.richiesta_id = z.id), '[]'::jsonb)
      ) as riga
      from public.richieste_zona z
      order by z.created_at desc
      limit 40
    ) x
  ), '[]'::jsonb);
end $$;
revoke all on function public.richieste_admin() from public;
grant execute on function public.richieste_admin() to authenticated;

notify pgrst, 'reload schema';
