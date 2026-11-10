-- ORTALY — notifiche sul telefono anche per il cliente (senza account): messaggi del produttore e cambi di stato dell'ordine.
-- Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run. Si può rieseguire.
create table if not exists public.notifiche_clienti (
  id uuid primary key default gen_random_uuid(),
  ordine uuid not null references public.ordini(id) on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text check (p256dh is null or char_length(p256dh) between 80 and 100),
  auth text check (auth is null or char_length(auth) between 16 and 30),
  creata timestamptz not null default now(),
  unique (ordine, endpoint)
);
alter table public.notifiche_clienti enable row level security;
revoke all on public.notifiche_clienti from anon, authenticated;

-- l'ultimo stato di cui il cliente è stato avvisato (per non avvisarlo due volte)
alter table public.ordini add column if not exists stato_avvisato text not null default 'nuovo';

-- il cliente attiva le notifiche per il suo ordine (con il link segreto)
create or replace function public.segui_ordine(p_segreto text, p_endpoint text, p_p256dh text, p_auth text)
returns boolean language plpgsql security definer set search_path = public as $$
declare o uuid; n int;
begin
  if p_segreto is null or p_segreto !~ '^[0-9a-f]{64}$' then raise exception 'Ordine non trovato'; end if;
  select id into o from public.ordini where segreto = p_segreto;
  if o is null then raise exception 'Ordine non trovato'; end if;
  if p_endpoint is null or p_endpoint not like 'https://%' or char_length(p_endpoint) > 1000 then raise exception 'Telefono non valido'; end if;
  select count(*) into n from public.notifiche_clienti where ordine = o;
  if n >= 5 then delete from public.notifiche_clienti where id = (select id from public.notifiche_clienti where ordine = o order by creata limit 1); end if;
  insert into public.notifiche_clienti (ordine, endpoint, p256dh, auth) values (o, p_endpoint, nullif(p_p256dh, ''), nullif(p_auth, ''))
  on conflict (ordine, endpoint) do update set p256dh = excluded.p256dh, auth = excluded.auth;
  return true;
end $$;
revoke all on function public.segui_ordine(text, text, text, text) from public;
grant execute on function public.segui_ordine(text, text, text, text) to anon, authenticated;

create or replace function public.smetti_ordine(p_segreto text, p_endpoint text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  delete from public.notifiche_clienti where endpoint = p_endpoint and ordine = (select id from public.ordini where segreto = p_segreto);
  return true;
end $$;
revoke all on function public.smetti_ordine(text, text) from public;
grant execute on function public.smetti_ordine(text, text) to anon, authenticated;
