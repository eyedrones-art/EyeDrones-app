-- EyeDrones — «Estendi alla regione»: oltre a «tutta Italia», l'amministratore può mandare una richiesta ai piloti
-- della stessa regione che fanno quel servizio (per esempio un matrimonio a Brescia ai piloti della Lombardia).
-- Aggiunge anche la tabella delle regioni (sigla → regione), che mancava.
-- Da eseguire una volta, DOPO richieste-estese.sql: SQL Editor → New query → incolla tutto → Run.

create table if not exists privato.regioni (sigla text primary key, regione text not null);
revoke all on privato.regioni from public, anon, authenticated;
insert into privato.regioni (sigla, regione) values
  ('AL', 'Piemonte'),
  ('AT', 'Piemonte'),
  ('BI', 'Piemonte'),
  ('CN', 'Piemonte'),
  ('NO', 'Piemonte'),
  ('TO', 'Piemonte'),
  ('VB', 'Piemonte'),
  ('VC', 'Piemonte'),
  ('AO', 'Valle d''Aosta'),
  ('BG', 'Lombardia'),
  ('BS', 'Lombardia'),
  ('CO', 'Lombardia'),
  ('CR', 'Lombardia'),
  ('LC', 'Lombardia'),
  ('LO', 'Lombardia'),
  ('MB', 'Lombardia'),
  ('MI', 'Lombardia'),
  ('MN', 'Lombardia'),
  ('PV', 'Lombardia'),
  ('SO', 'Lombardia'),
  ('VA', 'Lombardia'),
  ('BZ', 'Trentino-Alto Adige'),
  ('TN', 'Trentino-Alto Adige'),
  ('BL', 'Veneto'),
  ('PD', 'Veneto'),
  ('RO', 'Veneto'),
  ('TV', 'Veneto'),
  ('VE', 'Veneto'),
  ('VI', 'Veneto'),
  ('VR', 'Veneto'),
  ('GO', 'Friuli-Venezia Giulia'),
  ('PN', 'Friuli-Venezia Giulia'),
  ('TS', 'Friuli-Venezia Giulia'),
  ('UD', 'Friuli-Venezia Giulia'),
  ('GE', 'Liguria'),
  ('IM', 'Liguria'),
  ('SP', 'Liguria'),
  ('SV', 'Liguria'),
  ('BO', 'Emilia-Romagna'),
  ('FC', 'Emilia-Romagna'),
  ('FE', 'Emilia-Romagna'),
  ('MO', 'Emilia-Romagna'),
  ('PC', 'Emilia-Romagna'),
  ('PR', 'Emilia-Romagna'),
  ('RA', 'Emilia-Romagna'),
  ('RE', 'Emilia-Romagna'),
  ('RN', 'Emilia-Romagna'),
  ('AR', 'Toscana'),
  ('FI', 'Toscana'),
  ('GR', 'Toscana'),
  ('LI', 'Toscana'),
  ('LU', 'Toscana'),
  ('MS', 'Toscana'),
  ('PI', 'Toscana'),
  ('PO', 'Toscana'),
  ('PT', 'Toscana'),
  ('SI', 'Toscana'),
  ('PG', 'Umbria'),
  ('TR', 'Umbria'),
  ('AN', 'Marche'),
  ('AP', 'Marche'),
  ('FM', 'Marche'),
  ('MC', 'Marche'),
  ('PU', 'Marche'),
  ('FR', 'Lazio'),
  ('LT', 'Lazio'),
  ('RI', 'Lazio'),
  ('RM', 'Lazio'),
  ('VT', 'Lazio'),
  ('AQ', 'Abruzzo'),
  ('CH', 'Abruzzo'),
  ('PE', 'Abruzzo'),
  ('TE', 'Abruzzo'),
  ('CB', 'Molise'),
  ('IS', 'Molise'),
  ('AV', 'Campania'),
  ('BN', 'Campania'),
  ('CE', 'Campania'),
  ('NA', 'Campania'),
  ('SA', 'Campania'),
  ('BA', 'Puglia'),
  ('BR', 'Puglia'),
  ('BT', 'Puglia'),
  ('FG', 'Puglia'),
  ('LE', 'Puglia'),
  ('TA', 'Puglia'),
  ('MT', 'Basilicata'),
  ('PZ', 'Basilicata'),
  ('CS', 'Calabria'),
  ('CZ', 'Calabria'),
  ('KR', 'Calabria'),
  ('RC', 'Calabria'),
  ('VV', 'Calabria'),
  ('AG', 'Sicilia'),
  ('CL', 'Sicilia'),
  ('CT', 'Sicilia'),
  ('EN', 'Sicilia'),
  ('ME', 'Sicilia'),
  ('PA', 'Sicilia'),
  ('RG', 'Sicilia'),
  ('SR', 'Sicilia'),
  ('TP', 'Sicilia'),
  ('CA', 'Sardegna'),
  ('NU', 'Sardegna'),
  ('OR', 'Sardegna'),
  ('SS', 'Sardegna'),
  ('SU', 'Sardegna')
on conflict (sigla) do update set regione = excluded.regione;

alter table privato.richieste_estese add column if not exists ambito text not null default 'italia'; -- italia | regione

create or replace function privato.stessa_regione(a text, b text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from privato.regioni x join privato.regioni y on x.regione = y.regione where x.sigla = upper(a) and y.sigla = upper(b));
$$;
revoke all on function privato.stessa_regione(text, text) from public, anon, authenticated;

-- il pilota può vedere questa richiesta estesa? (pagina attiva, fa quel servizio, dentro l'ambito, richiesta aperta)
create or replace function privato.vede_estesa(p_uid uuid, p_richiesta uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from privato.richieste_estese e
    join public.richieste_zona z on z.id = e.richiesta_id
    join public.pagine_pilota g on g.user_id = p_uid
    where e.richiesta_id = p_richiesta and z.stato = 'aperta'
      and g.attiva and g.scelte_decadute < 2 and not g.escluso_trova
      and (e.ambito = 'italia' or privato.stessa_regione(g.provincia, z.provincia))
      and privato.admin_adatto(to_jsonb(g), z.servizio, g.provincia));
$$;
revoke all on function privato.vede_estesa(uuid, uuid) from public, anon, authenticated;

-- l'amministratore estende la richiesta: p_ambito 'regione' (piloti della stessa regione) o 'italia' (tutti)
create or replace function public.estendi_richiesta_admin(p_richiesta uuid, p_ambito text)
returns int language plpgsql volatile security definer set search_path = public as $$
declare v_z public.richieste_zona; v_piloti jsonb; v_ambito text := case when p_ambito = 'regione' then 'regione' else 'italia' end;
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it') then
    raise exception 'non autorizzato';
  end if;
  select * into v_z from public.richieste_zona where id = p_richiesta and stato = 'aperta';
  if not found then raise exception 'richiesta non aperta'; end if;
  -- da regione si può allargare a tutta Italia, non il contrario
  insert into privato.richieste_estese (richiesta_id, ambito) values (v_z.id, v_ambito)
    on conflict (richiesta_id) do update set ambito = case when privato.richieste_estese.ambito = 'italia' then 'italia' else excluded.ambito end;

  select coalesce(jsonb_agg(e) filter (where e is not null), '[]'::jsonb) into v_piloti
  from (
    select privato.pilota_contatto(g.user_id) ->> 'email' as e
    from public.pagine_pilota g
    where g.attiva and coalesce((to_jsonb(g) ->> 'in_elenco')::boolean, true) and g.scelte_decadute < 2 and not g.escluso_trova
      and g.provincia is distinct from v_z.provincia
      and (v_ambito = 'italia' or privato.stessa_regione(g.provincia, v_z.provincia))
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
revoke all on function public.estendi_richiesta_admin(uuid, text) from public;
grant execute on function public.estendi_richiesta_admin(uuid, text) to authenticated;

-- la versione vecchia (solo tutta Italia) chiama la nuova
create or replace function public.estendi_richiesta_admin(p_richiesta uuid)
returns int language sql volatile security definer set search_path = public as $$
  select public.estendi_richiesta_admin(p_richiesta, 'italia');
$$;
revoke all on function public.estendi_richiesta_admin(uuid) from public;
grant execute on function public.estendi_richiesta_admin(uuid) to authenticated;

-- la pagina Richieste: anche l'ambito dell'estensione e quanti piloti fuori provincia la vedono
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
        'ambito', (select e.ambito from privato.richieste_estese e where e.richiesta_id = z.id),
        -- quanti piloti fuori provincia la vedono grazie all'estensione
        'piloti_estesi', (
          select count(*) from privato.richieste_estese e
          join public.pagine_pilota g on g.attiva and coalesce((to_jsonb(g) ->> 'in_elenco')::boolean, true)
            and g.scelte_decadute < 2 and not g.escluso_trova and g.provincia is distinct from z.provincia
          where e.richiesta_id = z.id
            and (e.ambito = 'italia' or privato.stessa_regione(g.provincia, z.provincia))
            and privato.admin_adatto(to_jsonb(g), z.servizio, g.provincia)),
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
