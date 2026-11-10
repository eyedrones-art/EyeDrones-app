-- EYEDRONES — notifiche sul telefono dei piloti (nuove richieste in zona, «sei stato scelto», annullamenti...).
-- Da incollare nel progetto Supabase di EYEDRONES, SQL Editor → Run. Si può rieseguire.
-- Ogni telefono su cui un pilota attiva le notifiche è una riga qui. Le notifiche le manda la funzione Netlify
-- avviso-lavori (la stessa che manda le email): chiede i telefoni con push_destinatari, protetta da avviso_segreto.
create table if not exists public.notifiche_push (
  id uuid primary key default gen_random_uuid(),
  utente uuid not null references auth.users(id) on delete cascade default auth.uid(),
  endpoint text not null unique check (endpoint like 'https://%' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 80 and 100),
  auth text not null check (char_length(auth) between 16 and 30),
  creata timestamptz not null default now()
);
create index if not exists notifiche_push_utente on public.notifiche_push(utente);

alter table public.notifiche_push enable row level security;
drop policy if exists "notifiche push mie" on public.notifiche_push;
create policy "notifiche push mie" on public.notifiche_push for all to authenticated
  using (utente = auth.uid()) with check (utente = auth.uid());
revoke all on public.notifiche_push from anon;
grant select, insert, delete on public.notifiche_push to authenticated;

-- per la funzione avviso-lavori: i telefoni delle persone a cui sta mandando l'email (email dell'account o del profilo)
create or replace function public.push_destinatari(p_segreto text, p_email text[])
returns table (endpoint text, p256dh text, auth text)
language plpgsql stable security definer set search_path = public as $$
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  return query
    select n.endpoint, n.p256dh, n.auth
    from public.notifiche_push n
    join auth.users u on u.id = n.utente
    left join public.profili p on p.user_id = u.id
    where lower(u.email) = any (select lower(x) from unnest(p_email) x)
       or lower(p.email) = any (select lower(x) from unnest(p_email) x)
    limit 200;
end $$;
revoke all on function public.push_destinatari(text, text[]) from public;
grant execute on function public.push_destinatari(text, text[]) to anon;

-- per la funzione avviso-lavori: toglie un telefono che non esiste più (il servizio di notifiche risponde 404/410)
create or replace function public.push_togli(p_segreto text, p_endpoint text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  delete from public.notifiche_push where endpoint = p_endpoint;
end $$;
revoke all on function public.push_togli(text, text) from public;
grant execute on function public.push_togli(text, text) to anon;
