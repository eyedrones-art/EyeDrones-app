-- «Trova un pilota»: come su Malt, il pilota vede se il cliente è nuovo su EyeDrones o ha già confermato lavori.
-- Solo un sì/no e un numero: niente nome, email o altri dati del cliente. Si può rilanciare.
create or replace function public.storia_clienti_zona()
returns json
language sql stable security definer set search_path = public
as $$
  select coalesce(json_object_agg(z.id, json_build_object(
    -- prima richiesta con questa email
    'nuovo', not exists (select 1 from public.richieste_zona p where lower(p.email) = lower(z.email) and p.created_at < z.created_at),
    -- lavori già confermati da questo cliente con qualunque pilota
    'confermati', (select count(*) from public.richieste_zona p where lower(p.email) = lower(z.email) and p.id <> z.id and p.stato = 'confermata')
  )), '{}'::json)
  from public.richieste_zona z
  join public.pagine_pilota g on g.user_id = auth.uid() and g.attiva
  -- solo le richieste che il pilota vede già in «Lavori nella tua zona»
  where ((z.pilota_diretto is null and g.provincia = z.provincia) or z.pilota_diretto = auth.uid())
    and z.created_at > now() - interval '120 days';
$$;
revoke all on function public.storia_clienti_zona() from public;
grant execute on function public.storia_clienti_zona() to authenticated;
