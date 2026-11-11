-- EyeDrones Solare — contatti raccolti dalla pagina app.eyedrones.it/solare (stima fotovoltaico + preventivo).
-- Li salva la funzione Netlify «solare» con il codice segreto delle email (avviso_segreto). Nessuno li legge dal sito.
-- Da eseguire una volta su Supabase EyeDrones: SQL Editor → incolla → Run. Si può rieseguire.
create schema if not exists privato;
create table if not exists privato.solare_contatti (
  id bigint generated always as identity primary key,
  telefono text not null,
  dati jsonb not null,
  stato text not null default 'nuovo',   -- nuovo | chiamato | sopralluogo | contratto | perso
  creato timestamptz not null default now()
);
revoke all on privato.solare_contatti from public, anon, authenticated;

create or replace function public.solare_salva(p_segreto text, p_dati jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare v_tel text := regexp_replace(coalesce(p_dati->>'telefono', ''), '\D', '', 'g');
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  if char_length(v_tel) < 7 or coalesce((p_dati->>'consenso')::boolean, false) = false then raise exception 'dati non validi'; end if;
  -- stesso telefono nelle ultime 24 ore: non lo salvo due volte
  if exists (select 1 from privato.solare_contatti where telefono = v_tel and creato > now() - interval '24 hours') then return 'doppione'; end if;
  insert into privato.solare_contatti (telefono, dati) values (v_tel, p_dati);
  return 'ok';
end $$;
revoke all on function public.solare_salva(text, jsonb) from public;
grant execute on function public.solare_salva(text, jsonb) to anon;

-- per vedere i contatti: select creato, dati->>'nome' nome, dati->>'telefono' telefono, dati->>'indirizzo' dove, stato from privato.solare_contatti order by creato desc;
select 'Contatti solare pronti' as fatto;
