-- EYEDRONES — «Trova un pilota»: notifiche sul telefono anche per i clienti (senza account).
-- Dalla pagina delle offerte (/offerte/<codice>) il cliente tocca «Avvisami su questo telefono»: il telefono resta legato
-- a quella richiesta. Quando parte un'email per lui (nuova offerta, pilota confermato, lavoro consegnato...) la funzione
-- avviso-lavori manda anche la notifica, con push_destinatari (che ora trova anche i telefoni dei clienti).
-- Serve aver già eseguito trova-pilota.sql e notifiche-push.sql. Da eseguire una volta: SQL Editor → Run. Si può rieseguire.

create table if not exists public.notifiche_clienti_zona (
  id uuid primary key default gen_random_uuid(),
  richiesta uuid not null references public.richieste_zona(id) on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 30),
  creata timestamptz not null default now(),
  unique (richiesta, endpoint)
);
alter table public.notifiche_clienti_zona enable row level security;
revoke all on public.notifiche_clienti_zona from anon, authenticated;

-- il cliente attiva o spegne gli avvisi con il codice segreto della sua richiesta (al massimo 5 telefoni per richiesta)
create or replace function public.avvisi_cliente_zona(p_codice text, p_endpoint text, p_p256dh text default null, p_auth text default null, p_attiva boolean default true)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then raise exception 'Richiesta non trovata'; end if;
  select id into v_id from public.richieste_zona where codice = p_codice;
  if v_id is null then raise exception 'Richiesta non trovata'; end if;
  if not p_attiva then
    delete from public.notifiche_clienti_zona where richiesta = v_id and endpoint = p_endpoint;
    return false;
  end if;
  if (select count(*) from public.notifiche_clienti_zona where richiesta = v_id and endpoint <> p_endpoint) >= 5 then
    raise exception 'Troppi telefoni per questa richiesta';
  end if;
  insert into public.notifiche_clienti_zona (richiesta, endpoint, p256dh, auth) values (v_id, p_endpoint, p_p256dh, p_auth)
  on conflict (richiesta, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth, creata = now();
  return true;
end $$;
revoke all on function public.avvisi_cliente_zona(text, text, text, text, boolean) from public;
grant execute on function public.avvisi_cliente_zona(text, text, text, text, boolean) to anon, authenticated;

-- i telefoni a cui mandare la notifica: piloti (account) e ora anche clienti (dalla loro email nelle richieste)
create or replace function public.push_destinatari(p_segreto text, p_email text[])
returns table (endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  return query
    select x.endpoint, x.p256dh, x.auth from (
      select n.endpoint, n.p256dh, n.auth
      from public.notifiche_push n
      join auth.users u on u.id = n.utente
      left join public.profili p on p.user_id = u.id
      where lower(u.email) = any (select lower(e) from unnest(p_email) e)
         or lower(p.email) = any (select lower(e) from unnest(p_email) e)
      union
      select c.endpoint, c.p256dh, c.auth
      from public.notifiche_clienti_zona c
      join public.richieste_zona r on r.id = c.richiesta
      where lower(r.email) = any (select lower(e) from unnest(p_email) e)
    ) x
    limit 200;
end $$;
revoke all on function public.push_destinatari(text, text[]) from public;
grant execute on function public.push_destinatari(text, text[]) to anon;

-- un telefono che non esiste più si toglie da tutte e due le tabelle
create or replace function public.push_togli(p_segreto text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  delete from public.notifiche_push where endpoint = p_endpoint;
  delete from public.notifiche_clienti_zona where endpoint = p_endpoint;
end $$;
revoke all on function public.push_togli(text, text) from public;
grant execute on function public.push_togli(text, text) to anon;

select 'Notifiche per i clienti di Trova un pilota attive' as fatto;
