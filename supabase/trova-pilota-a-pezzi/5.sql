-- Trova un pilota, pezzo 5 di 5. Lanciali in ordine, uno alla volta (si possono rilanciare).
-- 12) «I miei lavori»: il cliente scrive la sua email e riceve il link personale (sullo schermo non compare niente)
create or replace function public.link_miei_lavori(p_email text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); v_nome text; v_ultimo timestamptz;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return true; end if;
  select nome into v_nome from public.richieste_zona where email = v_email order by created_at desc limit 1;
  if not found then return true; end if;
  perform privato.codice_cliente(v_email);
  select link_inviato into v_ultimo from public.clienti_zona where email = v_email for update;
  -- al massimo un'email ogni 10 minuti per persona, e 100 all'ora in tutto
  if v_ultimo > now() - interval '10 minutes' then return true; end if;
  if (select count(*) from public.clienti_zona where link_inviato > now() - interval '1 hour') >= 100 then return true; end if;
  update public.clienti_zona set link_inviato = now() where email = v_email;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'miei_lavori', 'a', v_email, 'nome', v_nome));
  return true;
end;
$$;
revoke all on function public.link_miei_lavori(text) from public;
grant execute on function public.link_miei_lavori(text) to anon, authenticated;

-- tutte le richieste del cliente, con il pilota dei lavori confermati (contatti, consegna, stelle)
create or replace function public.miei_lavori(p_cliente text)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare v_email text;
begin
  select email into v_email from public.clienti_zona where codice = p_cliente;
  if not found then return null; end if;
  perform privato.scadi_scelte();
  return json_build_object(
    'nome', (select nome from public.richieste_zona where email = v_email order by created_at desc limit 1),
    'lavori', coalesce((
      select json_agg(json_build_object(
        'codice', z.codice, 'servizio', z.servizio, 'luogo', z.luogo, 'data_desiderata', z.data_desiderata,
        'stato', z.stato, 'created_at', z.created_at, 'diretta', z.pilota_diretto is not null,
        'offerte', (select count(*) from public.offerte_zona x where x.richiesta_id = z.id and x.stato not in ('decaduta', 'rinunciata')),
        'scelto', (select privato.nome_breve(privato.pilota_contatto(x.user_id)->>'nome') from public.offerte_zona x where x.id = z.offerta_scelta and z.stato = 'scelta'),
        'pilota', case when o.id is not null then json_build_object(
          'nome', coalesce(nullif(g.nome, ''), p.azienda_nome, 'Pilota'), 'logo', p.azienda_logo,
          'contatti', privato.pilota_contatto(o.user_id) - 'email',
          'disponibile', coalesce(g.attiva, false) and not coalesce(g.escluso_trova, false)) end,
        'prezzo', o.prezzo, 'consegna', o.consegna, 'consegnata_il', o.consegnata_il, 'stelle', o.stelle
      ) order by z.created_at desc)
      from public.richieste_zona z
      left join public.offerte_zona o on o.richiesta_id = z.id and o.stato = 'confermata'
      left join public.pagine_pilota g on g.user_id = o.user_id
      left join public.profili p on p.user_id = o.user_id
      where z.email = v_email
    ), '[]'::json)
  );
end;
$$;
revoke all on function public.miei_lavori(text) from public;
grant execute on function public.miei_lavori(text) to anon, authenticated;

-- «Richiedi di nuovo»: da un lavoro confermato, una nuova richiesta che arriva solo a quel pilota
create or replace function public.richiedi_di_nuovo(p_cliente text, p_lavoro text, p_servizio text, p_luogo text, p_data date, p_descrizione text, p_budget text default null)
returns json
language plpgsql volatile security definer set search_path = public
as $$
declare v_email text; v_z public.richieste_zona; v_o public.offerte_zona; v_n public.richieste_zona; v_p jsonb;
begin
  select email into v_email from public.clienti_zona where codice = p_cliente;
  if not found then raise exception 'link non valido'; end if;
  select * into v_z from public.richieste_zona where codice = p_lavoro and email = v_email and stato = 'confermata';
  if not found then raise exception 'lavoro non trovato'; end if;
  select * into v_o from public.offerte_zona where richiesta_id = v_z.id and stato = 'confermata';
  if not exists (select 1 from public.pagine_pilota g where g.user_id = v_o.user_id and g.attiva and not g.escluso_trova) then
    raise exception 'pilota non disponibile';
  end if;
  if length(btrim(coalesce(p_descrizione, ''))) < 10 and coalesce(btrim(p_servizio), '') = '' then raise exception 'descrizione mancante'; end if;
  if (select count(*) from public.richieste_zona where created_at > now() - interval '1 hour' and email = v_email) >= 3
  then raise exception 'troppe richieste'; end if;

  insert into public.richieste_zona (provincia, nome, email, telefono, servizio, luogo, data_desiderata, descrizione, budget, pilota_diretto)
  values (
    v_z.provincia, v_z.nome, v_email, v_z.telefono,
    coalesce(nullif(left(btrim(coalesce(p_servizio, '')), 80), ''), v_z.servizio),
    nullif(left(btrim(coalesce(p_luogo, '')), 120), ''),
    case when p_data >= current_date and p_data < current_date + 730 then p_data end,
    nullif(left(btrim(coalesce(p_descrizione, '')), 2000), ''),
    case when p_budget in ('fino_300', '300_700', '700_1500', 'oltre_1500') then p_budget end,
    v_o.user_id
  )
  returning * into v_n;

  v_p := privato.pilota_contatto(v_o.user_id);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', jsonb_build_array(v_p->>'email'), 'diretto', true,
    'cliente_nome', v_n.nome, 'servizio', v_n.servizio, 'luogo', v_n.luogo, 'data_desiderata', v_n.data_desiderata,
    'descrizione', left(privato.senza_contatti(v_n.descrizione), 400), 'provincia', v_n.provincia));
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'richiesta_inviata', 'a', v_email, 'nome', v_n.nome,
    'codice', v_n.codice, 'piloti', 1, 'diretto_pilota', v_p->>'nome', 'provincia', v_n.provincia));
  return json_build_object('codice', v_n.codice);
end;
$$;
revoke all on function public.richiedi_di_nuovo(text, text, text, text, date, text, text) from public;
grant execute on function public.richiedi_di_nuovo(text, text, text, text, date, text, text) to anon, authenticated;

-- il pilota richiesto non risponde? il cliente manda la richiesta anche agli altri piloti della provincia
create or replace function public.apri_a_tutti(p_codice text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_z public.richieste_zona; v_piloti jsonb;
begin
  update public.richieste_zona set pilota_diretto = null
    where codice = p_codice and stato = 'aperta' and pilota_diretto is not null
    returning * into v_z;
  if v_z.id is null then return false; end if;
  select coalesce(jsonb_agg(privato.pilota_contatto(g.user_id)->>'email') filter (where privato.pilota_contatto(g.user_id)->>'email' is not null), '[]'::jsonb)
    into v_piloti
  from public.pagine_pilota g
  where g.attiva and g.in_elenco and g.scelte_decadute < 2 and not g.escluso_trova and g.provincia = v_z.provincia and coalesce(g.avviso_email, true)
    and not exists (select 1 from public.offerte_zona o where o.richiesta_id = v_z.id and o.user_id = g.user_id);
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'nuovo_lavoro', 'piloti', v_piloti,
    'servizio', v_z.servizio, 'luogo', v_z.luogo, 'data_desiderata', v_z.data_desiderata,
    'descrizione', left(privato.senza_contatti(v_z.descrizione), 400), 'provincia', v_z.provincia));
  return true;
end;
$$;
revoke all on function public.apri_a_tutti(text) from public;
grant execute on function public.apri_a_tutti(text) to anon, authenticated;

-- 13) il pilota consegna il lavoro: il link (galleria EyeDrones, Drive, WeTransfer, report) e una nota per il cliente
create or replace function public.consegna_lavoro_zona(p_offerta uuid, p_link text, p_nota text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona; v_z public.richieste_zona; v_link text := btrim(coalesce(p_link, ''));
begin
  select * into v_o from public.offerte_zona where id = p_offerta and user_id = auth.uid() and stato = 'confermata' for update;
  if not found then raise exception 'lavoro non trovato'; end if;
  if v_link !~ '^https://[^\s<>"]{4,}$' or length(v_link) > 600 then raise exception 'link non valido'; end if;
  select * into v_z from public.richieste_zona where id = v_o.richiesta_id;
  update public.offerte_zona
    set consegna = jsonb_build_object('link', v_link, 'nota', nullif(left(btrim(coalesce(p_nota, '')), 500), '')),
        consegnata_il = coalesce(consegnata_il, now())
    where id = v_o.id;
  -- l'email al cliente solo la prima volta (dopo, se il pilota cambia il link, il cliente lo trova aggiornato)
  if v_o.consegnata_il is null then
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'consegnato', 'a', v_z.email, 'nome', v_z.nome, 'codice', v_z.codice,
      'pilota', privato.pilota_contatto(v_o.user_id)->>'nome', 'servizio', v_z.servizio, 'link', v_link,
      'nota', nullif(left(btrim(coalesce(p_nota, '')), 500), '')));
  end if;
  return true;
end;
$$;
revoke all on function public.consegna_lavoro_zona(uuid, text, text) from public;
grant execute on function public.consegna_lavoro_zona(uuid, text, text) to authenticated;

-- 14) le stelle del cliente (da 1 a 5, con due righe facoltative): solo per un lavoro confermato, modificabili per 30 giorni
create or replace function public.lascia_recensione(p_codice text, p_stelle int, p_testo text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona; v_z public.richieste_zona;
begin
  if p_stelle is null or p_stelle < 1 or p_stelle > 5 then raise exception 'stelle non valide'; end if;
  select * into v_z from public.richieste_zona where codice = p_codice;
  if not found then raise exception 'richiesta non trovata'; end if;
  select * into v_o from public.offerte_zona where richiesta_id = v_z.id and stato = 'confermata' for update;
  if not found then raise exception 'lavoro non confermato'; end if;
  if not (v_o.consegnata_il is not null or v_z.data_desiderata <= current_date or v_o.confermata_il < now() - interval '7 days') then
    raise exception 'troppo presto';
  end if;
  if v_o.recensione_il is not null and v_o.recensione_il < now() - interval '30 days' then raise exception 'non più modificabile'; end if;
  -- niente stelle a sé stessi (richiesta fatta con l'email del pilota)
  if lower(v_z.email) in (select lower(coalesce(x, '')) from unnest(array[privato.pilota_contatto(v_o.user_id)->>'email', privato.pilota_contatto(v_o.user_id)->>'email_pubblica']) x) then
    raise exception 'non valida';
  end if;
  update public.offerte_zona
    set stelle = p_stelle, recensione = nullif(left(privato.senza_contatti(btrim(coalesce(p_testo, ''))), 600), ''),
        recensione_il = coalesce(recensione_il, now())
    where id = v_o.id;
  return true;
end;
$$;
revoke all on function public.lascia_recensione(text, int, text) from public;
grant execute on function public.lascia_recensione(text, int, text) to anon, authenticated;

-- le recensioni nella pagina pubblica del pilota: media, numero e le ultime con il testo (nome del cliente abbreviato)
create or replace function public.recensioni_pilota(p_slug text)
returns json
language sql stable security definer set search_path = public
as $$
  select json_build_object(
    'media', (privato.stelle_pilota(g.user_id)->>'media')::numeric,
    'numero', (privato.stelle_pilota(g.user_id)->>'numero')::int,
    'ultime', coalesce((
      select json_agg(json_build_object('stelle', t.stelle, 'testo', t.recensione, 'nome', t.nome, 'servizio', t.servizio, 'quando', t.recensione_il) order by t.recensione_il desc)
      from (
        select o.stelle, o.recensione, privato.nome_breve(z.nome) as nome, z.servizio, o.recensione_il
        from public.offerte_zona o join public.richieste_zona z on z.id = o.richiesta_id
        where o.user_id = g.user_id and o.stelle is not null
        order by (o.recensione is not null) desc, o.recensione_il desc
        limit 10
      ) t
    ), '[]'::json))
  from public.pagine_pilota g
  where g.slug = lower(btrim(p_slug)) and g.attiva;
$$;
revoke all on function public.recensioni_pilota(text) from public;
grant execute on function public.recensioni_pilota(text) to anon, authenticated;

-- 11) ogni ora: le scelte non confermate in 48 ore decadono (se pg_cron c'è; altrimenti succede quando si apre la pagina)
do $$
begin
  perform cron.unschedule('eyedrones-lavori') where exists (select 1 from cron.job where jobname = 'eyedrones-lavori');
  perform cron.schedule('eyedrones-lavori', '17 * * * *', 'select privato.scadi_scelte()');
exception when others then
  raise notice 'pg_cron non disponibile: le scelte decadono quando si aprono le pagine';
end $$;

-- i numeri di «Trova un pilota» (ultimi 30 giorni)
select provincia,
  count(*) as richieste,
  count(*) filter (where stato = 'confermata') as confermate,
  (select count(*) from public.offerte_zona o where o.richiesta_id = any(array_agg(z.id))) as offerte,
  (select coalesce(sum(commissione), 0) from public.offerte_zona o where o.stato = 'confermata' and o.richiesta_id = any(array_agg(z.id))) as commissioni_euro
from public.richieste_zona z
where created_at > now() - interval '30 days'
group by 1
order by 2 desc;

-- pagamenti da rimborsare su Stripe (pagati quando il cliente aveva già scelto un altro pilota)
select o.id, o.pagata_sessione, o.commissione from public.offerte_zona o where o.da_rimborsare;

-- piloti esclusi perché hanno preso il lavoro fuori da EyeDrones (per riammetterli: update public.pagine_pilota set escluso_trova = false where slug = '...')
select g.slug, g.nome, g.scelte_decadute from public.pagine_pilota g where g.escluso_trova;

