-- Eyedrones — preventivo collegato al lavoro: data prevista e tipo di volo
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi. L'app funziona anche prima: salva il preventivo senza questi due campi.
--
-- Quando un preventivo passa ad «Accettato», l'app crea il volo pianificato con questa data e questo tipo di volo
-- (il collegamento sta in piani_volo.checklist_stato.preventivo, non serve altro).
alter table public.preventivi add column if not exists data_lavoro date;
alter table public.preventivi add column if not exists tipo_volo text;
