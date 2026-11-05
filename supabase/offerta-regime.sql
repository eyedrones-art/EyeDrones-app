-- EyeDrones — «Trova un pilota»: il regime fiscale del pilota nell'offerta (IVA compresa o senza IVA per il cliente).
-- Ridefinisce privato.dettagli_offerta di trova-pilota.sql aggiungendo solo la voce «regime».
-- Da eseguire dopo trova-pilota.sql: SQL Editor → New query → incolla tutto → Run. Si può rieseguire.

create or replace function privato.dettagli_offerta(d jsonb)
returns jsonb language sql immutable as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'video_min', case when (d->>'video_min') ~ '^\d{1,3}$' and (d->>'video_min')::int between 1 and 180 then (d->>'video_min')::int end,
    'foto', case when (d->>'foto') ~ '^\d{1,4}$' and (d->>'foto')::int between 1 and 2000 then (d->>'foto')::int end,
    'consegna_giorni', case when (d->>'consegna_giorni') ~ '^\d{1,3}$' and (d->>'consegna_giorni')::int between 1 and 365 then (d->>'consegna_giorni')::int end,
    'ettari', case when (d->>'ettari') ~ '^\d{1,5}([.,]\d{1,2})?$' and replace(d->>'ettari', ',', '.')::numeric between 0.01 and 50000 then replace(d->>'ettari', ',', '.')::numeric end,
    'kwp', case when (d->>'kwp') ~ '^\d{1,6}$' and (d->>'kwp')::int between 1 and 500000 then (d->>'kwp')::int end,
    'reel', case when (d->>'reel') = 'true' then true end,
    'ortofoto', case when (d->>'ortofoto') = 'true' then true end,
    'modello3d', case when (d->>'modello3d') = 'true' then true end,
    'rtk', case when (d->>'rtk') = 'true' then true end,
    'report', case when (d->>'report') = 'true' then true end,
    'radiometrico', case when (d->>'radiometrico') = 'true' then true end,
    'registro', case when (d->>'registro') = 'true' then true end,
    'permessi', case when (d->>'permessi') = 'true' then true end,
    'sopralluogo', case when (d->>'sopralluogo') = 'true' then true end,
    -- il regime fiscale del pilota: il cliente legge «IVA compresa» o «senza IVA» sotto il prezzo
    'regime', case when (d->>'regime') in ('ordinario', 'forfettario', 'occasionale') then d->>'regime' end));
$$;
