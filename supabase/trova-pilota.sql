-- Eyedrones — «Trova un pilota» (app.eyedrones.it/trova-pilota): il cliente scrive cosa gli serve e in quale provincia,
-- la richiesta arriva ai piloti di quella provincia con «La mia pagina» attiva (al massimo 10).
-- Richiede di aver già eseguito «pagina-pilota.sql» (e, per l'email al pilota, «avviso-richieste-email.sql»).
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
--
-- Come funziona: la richiesta viene salvata in richieste_zona e copiata in richieste_preventivo per ogni pilota della
-- provincia, così il pilota la trova dove trova già le altre (con l'email di avviso e «Crea preventivo»).
-- Se in quel momento non c'è nessun pilota, resta in attesa: chi attiva la pagina in quella provincia nei 60 giorni
-- dopo la vede in «Lavori nella tua zona» (senza i contatti) e può prenderla. In tutto la ricevono al massimo 10 piloti.

-- 1) il pilota sceglie se comparire nell'elenco (di base sì: la sua pagina è già pubblica)
alter table public.pagine_pilota add column if not exists in_elenco boolean not null default true;

-- 2) da quale richiesta in zona viene una richiesta arrivata al pilota (vuoto = dalla sua pagina)
alter table public.richieste_preventivo add column if not exists da_zona uuid;
create unique index if not exists richieste_preventivo_zona_idx on public.richieste_preventivo (user_id, da_zona) where da_zona is not null;

-- 3) le richieste in zona: nessuno le legge direttamente, solo tramite le funzioni qui sotto
create table if not exists public.richieste_zona (
  id uuid primary key default gen_random_uuid(),
  provincia text not null,
  nome text not null,
  email text,
  telefono text,
  servizio text,
  luogo text,
  data_desiderata date,
  descrizione text,
  inviata_a int not null default 0,          -- a quanti piloti è arrivata
  created_at timestamptz not null default now()
);
create index if not exists richieste_zona_provincia_idx on public.richieste_zona (provincia, created_at desc);
alter table public.richieste_zona enable row level security;
revoke all on public.richieste_zona from anon, authenticated;

-- 4) i piloti di una provincia, solo i dati già pubblici della loro pagina
create or replace function public.piloti_in_zona(p_provincia text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(t.x order by t.ordine desc), '[]'::json)
  from (
    select g.aggiornata_il as ordine,
      json_build_object(
        'slug', g.slug,
        'nome', coalesce(nullif(g.nome, ''), p.azienda_nome),
        'logo', p.azienda_logo,
        'citta', g.citta,
        'provincia', g.provincia,
        'raggio_km', g.raggio_km,
        'servizi', g.servizi,
        'abilitazioni', g.abilitazioni,
        'assicurato', g.assicurato,
        'registrato', g.codice_operatore is not null and g.codice_operatore <> ''
      ) as x
    from public.pagine_pilota g
    left join public.profili p on p.user_id = g.user_id
    where g.attiva and g.in_elenco and g.provincia = upper(btrim(p_provincia))
    order by g.aggiornata_il desc
    limit 30
  ) t;
$$;
revoke all on function public.piloti_in_zona(text) from public;
grant execute on function public.piloti_in_zona(text) to anon, authenticated;

-- 5) il cliente invia la richiesta: risponde a quanti piloti è arrivata (0 = in attesa)
create or replace function public.invia_richiesta_zona(
  p_provincia text,
  p_nome text,
  p_email text,
  p_telefono text,
  p_servizio text,
  p_luogo text,
  p_data date,
  p_descrizione text
)
returns int
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_prov text := upper(left(btrim(coalesce(p_provincia, '')), 2));
  v_nome text := left(btrim(coalesce(p_nome, '')), 80);
  v_email text := nullif(left(lower(btrim(coalesce(p_email, ''))), 120), '');
  v_tel text := nullif(left(btrim(coalesce(p_telefono, '')), 30), '');
  v_id uuid;
  v_quanti int;
begin
  if v_prov !~ '^[A-Z]{2}$' then raise exception 'provincia mancante'; end if;
  if length(v_nome) < 2 then raise exception 'nome mancante'; end if;
  if v_email is null and v_tel is null then raise exception 'serve email o telefono'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email non valida'; end if;
  if length(btrim(coalesce(p_descrizione, ''))) < 10 and coalesce(btrim(p_servizio), '') = '' then raise exception 'descrizione mancante'; end if;

  -- stessa persona: al massimo 3 richieste in zona all'ora; in tutto al massimo 200 al giorno
  if (select count(*) from public.richieste_zona
      where created_at > now() - interval '1 hour'
        and ((v_email is not null and email = v_email) or (v_tel is not null and telefono = v_tel))) >= 3
  then raise exception 'troppe richieste'; end if;
  if (select count(*) from public.richieste_zona where created_at > now() - interval '1 day') >= 200
  then raise exception 'troppe richieste'; end if;

  -- pulizia: dopo 60 giorni la richiesta in attesa si cancella (le copie già arrivate ai piloti restano a loro)
  delete from public.richieste_zona where created_at < now() - interval '60 days';

  insert into public.richieste_zona (provincia, nome, email, telefono, servizio, luogo, data_desiderata, descrizione)
  values (
    v_prov, v_nome, v_email, v_tel,
    nullif(left(btrim(coalesce(p_servizio, '')), 80), ''),
    nullif(left(btrim(coalesce(p_luogo, '')), 120), ''),
    case when p_data >= current_date and p_data < current_date + 730 then p_data end,
    nullif(left(btrim(coalesce(p_descrizione, '')), 2000), '')
  )
  returning id into v_id;

  -- la copia per ogni pilota della provincia (al massimo 10, prima chi ha aggiornato la pagina da poco)
  insert into public.richieste_preventivo (user_id, nome, email, telefono, servizio, luogo, data_desiderata, descrizione, da_zona)
  select g.user_id, z.nome, z.email, z.telefono, z.servizio, z.luogo, z.data_desiderata,
         concat_ws(E'\n\n', z.descrizione, '— Richiesta arrivata da «Trova un pilota» (provincia ' || z.provincia || '): l''hanno ricevuta anche altri piloti della zona.'),
         z.id
  from public.richieste_zona z
  join lateral (
    select user_id from public.pagine_pilota
    where attiva and in_elenco and provincia = z.provincia
    order by aggiornata_il desc
    limit 10
  ) g on true
  where z.id = v_id;
  get diagnostics v_quanti = row_count;

  update public.richieste_zona set inviata_a = v_quanti where id = v_id;
  return v_quanti;
end;
$$;
revoke all on function public.invia_richiesta_zona(text, text, text, text, text, text, date, text) from public;
grant execute on function public.invia_richiesta_zona(text, text, text, text, text, text, date, text) to anon, authenticated;

-- 6) il pilota vede le richieste della sua provincia degli ultimi 60 giorni che non ha ancora (senza i contatti)
create or replace function public.lavori_in_zona()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(json_agg(json_build_object(
    'id', z.id,
    'servizio', z.servizio,
    'luogo', z.luogo,
    'data_desiderata', z.data_desiderata,
    'descrizione', left(z.descrizione, 400),
    'created_at', z.created_at,
    'posti', 10 - z.inviata_a
  ) order by z.created_at desc), '[]'::json)
  from public.richieste_zona z
  join public.pagine_pilota g on g.user_id = auth.uid() and g.attiva and g.provincia = z.provincia
  where z.created_at > now() - interval '60 days'
    and z.inviata_a < 10
    and (z.data_desiderata is null or z.data_desiderata >= current_date)
    and not exists (select 1 from public.richieste_preventivo r where r.user_id = auth.uid() and r.da_zona = z.id);
$$;
revoke all on function public.lavori_in_zona() from public;
grant execute on function public.lavori_in_zona() to authenticated;

-- 7) il pilota prende una richiesta in zona: la copia nelle sue richieste, con i contatti
create or replace function public.prendi_lavoro_in_zona(p_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'accesso richiesto'; end if;
  -- blocco la riga: due piloti nello stesso momento non superano i 10
  perform 1 from public.richieste_zona z
    join public.pagine_pilota g on g.user_id = v_uid and g.attiva and g.provincia = z.provincia
    where z.id = p_id and z.inviata_a < 10 and z.created_at > now() - interval '60 days'
    for update of z;
  if not found then raise exception 'richiesta non disponibile'; end if;
  if exists (select 1 from public.richieste_preventivo where user_id = v_uid and da_zona = p_id) then return true; end if;

  insert into public.richieste_preventivo (user_id, nome, email, telefono, servizio, luogo, data_desiderata, descrizione, da_zona)
  select v_uid, z.nome, z.email, z.telefono, z.servizio, z.luogo, z.data_desiderata,
         concat_ws(E'\n\n', z.descrizione, '— Richiesta arrivata da «Trova un pilota» (provincia ' || z.provincia || '): l''hanno ricevuta anche altri piloti della zona.'),
         z.id
  from public.richieste_zona z where z.id = p_id;
  update public.richieste_zona set inviata_a = inviata_a + 1 where id = p_id;
  return true;
end;
$$;
revoke all on function public.prendi_lavoro_in_zona(uuid) from public;
grant execute on function public.prendi_lavoro_in_zona(uuid) to authenticated;

-- quante richieste in zona sono arrivate (ultimi 30 giorni), per provincia e a quanti piloti
select provincia, count(*) as richieste, sum(inviata_a) as consegne, count(*) filter (where inviata_a = 0) as in_attesa
from public.richieste_zona
where created_at > now() - interval '30 days'
group by 1
order by 2 desc;
