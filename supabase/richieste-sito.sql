-- EyeDrones — le richieste di preventivo del sito eyedrones.it arrivano anche nell'app di Ivan
-- (La mia pagina → Richieste, con il pulsante per fare subito il preventivo), oltre all'email di Netlify.
-- Il sito chiama la funzione richiesta_dal_sito: scrive solo nelle richieste di Ivan, non legge niente.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
-- Serve pagina-pilota.sql già eseguito.

create or replace function public.richiesta_dal_sito(
  p_nome text,
  p_contatto text,
  p_servizio text,
  p_comune text,
  p_messaggio text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_pilota uuid;
  v_nome text := left(btrim(coalesce(p_nome, '')), 80);
  v_contatto text := left(btrim(coalesce(p_contatto, '')), 120);
  v_email text;
  v_tel text;
begin
  -- l'account di Ivan (prima quello che ha la pagina pilota)
  select u.id into v_pilota
  from auth.users u
  where lower(u.email) in ('eyedrones@libero.it', 'ravinale.ivan@libero.it')
  order by exists (select 1 from public.pagine_pilota g where g.user_id = u.id) desc, u.created_at
  limit 1;
  if v_pilota is null then raise exception 'pilota non trovato'; end if;

  if length(v_nome) < 2 then raise exception 'nome mancante'; end if;
  if position('@' in v_contatto) > 0 then
    v_email := lower(v_contatto);
    if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'email non valida'; end if;
  else
    v_tel := nullif(regexp_replace(v_contatto, '[^\d+ ]', '', 'g'), '');
    if v_tel is null or length(regexp_replace(v_tel, '\D', '', 'g')) < 6 then raise exception 'serve email o telefono'; end if;
    v_tel := left(v_tel, 30);
  end if;

  -- stessi limiti della pagina pilota: 3 all'ora dalla stessa persona, 40 al giorno in tutto
  if (select count(*) from public.richieste_preventivo
      where user_id = v_pilota and created_at > now() - interval '1 hour'
        and ((v_email is not null and email = v_email) or (v_tel is not null and telefono = v_tel))) >= 3
  then raise exception 'troppe richieste'; end if;
  if (select count(*) from public.richieste_preventivo where user_id = v_pilota and created_at > now() - interval '1 day') >= 40
  then raise exception 'troppe richieste'; end if;

  insert into public.richieste_preventivo (user_id, nome, email, telefono, servizio, luogo, descrizione)
  values (
    v_pilota, v_nome, v_email, v_tel,
    nullif(left(btrim(coalesce(p_servizio, '')), 80), ''),
    nullif(left(btrim(coalesce(p_comune, '')), 120), ''),
    left('Dal sito eyedrones.it' || coalesce(E'\n' || nullif(btrim(p_messaggio), ''), ''), 2000)
  );
  return true;
end;
$$;

revoke all on function public.richiesta_dal_sito(text, text, text, text, text) from public;
grant execute on function public.richiesta_dal_sito(text, text, text, text, text) to anon, authenticated;

-- prova: deve uscire «true» (poi la richiesta di prova si cancella da La mia pagina → Richieste)
-- select public.richiesta_dal_sito('Prova sito', 'prova@esempio.it', 'Altro', 'Torino', 'richiesta di prova');
