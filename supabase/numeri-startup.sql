-- EyeDrones — «📊 I numeri di EyeDrones»: il pannello che vede solo l'amministratore (Impostazioni)
-- Iscritti, chi usa davvero l'app, Trova un pilota (richieste → offerte → lavori confermati → soldi passati) mese per mese.
-- Sono i numeri da mostrare a bandi e investitori. Nessun nome né email: solo conteggi e totali.
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
-- Le parti che usano tabelle non ancora create (uso giornaliero, Trova un pilota, posti, Esperto) restano a zero.

create or replace function public.numeri_startup()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_oggi jsonb := '{}';
  v_trova jsonb := '{}';
  v_mesi jsonb := '[]';
  v_n bigint;
  v_m record;
  v_riga jsonb;
begin
  if coalesce(auth.jwt() ->> 'email', '') not in ('eyedrones@libero.it', 'ravinale.ivan@libero.it') then
    return null;
  end if;

  -- oggi
  v_oggi := jsonb_build_object(
    'iscritti', (select count(*) from auth.users),
    'iscritti_7', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'iscritti_30', (select count(*) from auth.users where created_at > now() - interval '30 days'),
    'con_drone', (select count(distinct user_id) from public.droni),
    'con_3_voli', (select count(*) from (select user_id from public.voli group by user_id having count(*) >= 3) x)
  );
  if to_regclass('public.uso_giornaliero') is not null then
    v_oggi := v_oggi || jsonb_build_object(
      'attivi_7', (select count(distinct user_id) from public.uso_giornaliero where giorno > current_date - 7),
      'attivi_30', (select count(distinct user_id) from public.uso_giornaliero where giorno > current_date - 30));
  end if;
  if to_regclass('public.posti_consigliati') is not null then
    v_oggi := v_oggi || jsonb_build_object('posti', (select count(*) from public.posti_consigliati));
  end if;
  if to_regclass('public.posti_grazie') is not null then
    v_oggi := v_oggi || jsonb_build_object('grazie', (select count(*) from public.posti_grazie));
  end if;
  if to_regclass('public.esperto_acquisti') is not null then
    v_oggi := v_oggi || jsonb_build_object('esperto_euro', (select coalesce(sum(importo_centesimi), 0) / 100.0 from public.esperto_acquisti));
  end if;

  -- Trova un pilota, dall'inizio: il percorso di una richiesta
  if to_regclass('public.richieste_zona') is not null and to_regclass('public.offerte_zona') is not null then
    v_trova := jsonb_build_object(
      'piloti', (select count(*) from public.pagine_pilota g where g.attiva and g.in_elenco and not g.escluso_trova),
      'richieste', (select count(*) from public.richieste_zona),
      'con_offerte', (select count(*) from public.richieste_zona z where exists (select 1 from public.offerte_zona o where o.richiesta_id = z.id)),
      'scelte', (select count(*) from public.richieste_zona where scelta_il is not null),
      'confermati', (select count(*) from public.offerte_zona where confermata_il is not null),
      'consegnati', (select count(*) from public.offerte_zona where consegnata_il is not null),
      'valore', (select coalesce(sum(prezzo), 0) from public.offerte_zona where confermata_il is not null),
      'commissioni', (select coalesce(sum(commissione), 0) from public.offerte_zona where confermata_il is not null),
      'stelle', (select round(avg(stelle)::numeric, 1) from public.offerte_zona where stelle is not null),
      'recensioni', (select count(*) from public.offerte_zona where stelle is not null),
      -- provincia per provincia: piloti nell'elenco e richieste degli ultimi 90 giorni (dove mancano piloti)
      'province', (
        select coalesce(jsonb_agg(jsonb_build_object('provincia', x.provincia, 'piloti', x.piloti, 'richieste', x.richieste) order by x.piloti desc, x.richieste desc, x.provincia), '[]')
        from (
          select pr.provincia,
            (select count(*) from public.pagine_pilota g where upper(btrim(g.provincia)) = pr.provincia and g.attiva and g.in_elenco and not g.escluso_trova and g.scelte_decadute < 2) as piloti,
            (select count(*) from public.richieste_zona z where upper(btrim(z.provincia)) = pr.provincia and z.created_at > now() - interval '90 days') as richieste
          from (
            select distinct upper(btrim(provincia)) as provincia from public.pagine_pilota where provincia is not null and btrim(provincia) <> '' and attiva
            union
            select distinct upper(btrim(provincia)) from public.richieste_zona where provincia is not null and created_at > now() - interval '90 days'
          ) pr
        ) x
      )
    );
  end if;

  -- mese per mese, gli ultimi 12 (il mese in corso per ultimo)
  for v_m in
    select d::date as inizio, (d + interval '1 month')::date as fine
    from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') d
  loop
    v_riga := jsonb_build_object(
      'mese', to_char(v_m.inizio, 'YYYY-MM'),
      'nuovi', (select count(*) from auth.users where created_at >= v_m.inizio and created_at < v_m.fine),
      'totale', (select count(*) from auth.users where created_at < v_m.fine)
    );
    if to_regclass('public.uso_giornaliero') is not null then
      v_riga := v_riga || jsonb_build_object('attivi', (select count(distinct user_id) from public.uso_giornaliero where giorno >= v_m.inizio and giorno < v_m.fine));
    end if;
    if to_regclass('public.richieste_zona') is not null and to_regclass('public.offerte_zona') is not null then
      v_riga := v_riga || jsonb_build_object(
        'richieste', (select count(*) from public.richieste_zona where created_at >= v_m.inizio and created_at < v_m.fine),
        'confermati', (select count(*) from public.offerte_zona where confermata_il >= v_m.inizio and confermata_il < v_m.fine),
        'valore', (select coalesce(sum(prezzo), 0) from public.offerte_zona where confermata_il >= v_m.inizio and confermata_il < v_m.fine),
        'commissioni', (select coalesce(sum(commissione), 0) from public.offerte_zona where confermata_il >= v_m.inizio and confermata_il < v_m.fine)
      );
    end if;
    v_mesi := v_mesi || jsonb_build_array(v_riga);
  end loop;

  return jsonb_build_object('oggi', v_oggi, 'trova', v_trova, 'mesi', v_mesi, 'calcolato', now());
end;
$$;
revoke all on function public.numeri_startup() from public, anon;
grant execute on function public.numeri_startup() to authenticated;
