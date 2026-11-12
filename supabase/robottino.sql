-- Robottino assistente: i numeri del mattino (gli stessi del messaggio Telegram) per la funzione Netlify «robottino».
-- Solo numeri, con il codice segreto delle email. Da eseguire una volta su Supabase EyeDrones: SQL Editor → incolla → Run.
create or replace function public.robottino_numeri(p_segreto text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_segreto is null or p_segreto is distinct from (select valore from privato.impostazioni where chiave = 'avviso_segreto') then
    raise exception 'non autorizzato';
  end if;
  return privato.numeri_mattino();
end $$;
revoke all on function public.robottino_numeri(text) from public;
grant execute on function public.robottino_numeri(text) to anon;
select 'Robottino pronto' as fatto;
