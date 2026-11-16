-- ORTALY — «Ricette e cosa c'è di stagione»: iscrizione anche senza ordinare (con email di conferma)
-- e l'email automatica del 1° e del 15 del mese (la manda la funzione Netlify ortaly-stagione).
-- Da incollare nel progetto Supabase DI ORTALY, SQL Editor → Run, DOPO ortaly-chat.sql. Si può rieseguire.

-- chi si è iscritto con la spunta in un ordine è già confermato (default true);
-- chi si iscrive dal riquadro della pagina parte da false e diventa true con il link dell'email
alter table public.novita add column if not exists confermato boolean not null default true;
alter table public.novita add column if not exists conferma_inviata timestamptz;
-- quando gli è arrivata l'ultima email di stagione (per non mandarne due di fila)
alter table public.novita add column if not exists ultima_stagione timestamptz;

create or replace function public.novita_conferma(p_token text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_token is null or p_token !~ '^[0-9a-f]{64}$' then return false; end if;
  update public.novita set confermato = true, disiscritto = null, consenso = now() where token = p_token;
  return found;
end $$;
revoke all on function public.novita_conferma(text) from public;
grant execute on function public.novita_conferma(text) to anon, authenticated;

-- chi ordina con la spunta conferma anche un'iscrizione rimasta in sospeso dal riquadro
create or replace function public.novita_da_ordine()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.disiscritto is null and old.confermato = false and new.consenso > old.consenso then
    new.confermato := true;
  end if;
  return new;
end $$;
drop trigger if exists novita_da_ordine on public.novita;
create trigger novita_da_ordine before update on public.novita for each row execute function public.novita_da_ordine();

-- quanti sono iscritti (confermati) per provincia
select coalesce(provincia, '?') as provincia, count(*) as iscritti
from public.novita where disiscritto is null and confermato
group by 1 order by 2 desc;
