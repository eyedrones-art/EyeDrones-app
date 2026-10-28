-- Codice di condotta dei piloti di «Trova un pilota»: il pilota lo firma dalla sua pagina,
-- i clienti vedono il bollino sulla pagina pubblica. Da lanciare dopo pagina-pilota.sql e trova-pilota.sql.

alter table public.pagine_pilota add column if not exists codice_firmato_il timestamptz;  -- quando il pilota ha firmato

-- per la pagina pubblica: il pilota con questo indirizzo ha firmato il codice? (solo sì/no, nessun altro dato)
create or replace function public.codice_condotta_pilota(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select g.codice_firmato_il is not null from public.pagine_pilota g where g.slug = lower(p_slug) and g.attiva limit 1), false);
$$;

revoke all on function public.codice_condotta_pilota(text) from public;
grant execute on function public.codice_condotta_pilota(text) to anon, authenticated;
