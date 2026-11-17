-- EYEDRONES — «Trova un pilota»: il cliente può cercare un pilota per una collaborazione fissa (agenzie, wedding planner, aziende).
-- La richiesta «Collaborazione continuativa» arriva a tutti i piloti della zona, come «Altro».
-- Serve aver già eseguito lavori-per-servizio.sql. Da eseguire una volta: SQL Editor → Run. Si può rieseguire.

create or replace function privato.pilota_adatto(p_servizi text[], p_servizio text, p_provincia text)
returns boolean language sql stable security definer set search_path = public as $$
  -- p_provincia non serve più (resta per non cambiare le chiamate)
  select coalesce(btrim(p_servizio), '') in ('', 'Altro', 'Collaborazione continuativa')
    or cardinality(coalesce(p_servizi, '{}')) = 0
    or privato.fa_servizio(p_servizi, p_servizio);
$$;
revoke all on function privato.pilota_adatto(text[], text, text) from public, anon, authenticated;

select 'Collaborazione fissa attiva' as fatto;
