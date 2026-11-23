-- Quaderno di campagna: tempo di carenza (giorni) e rientro nel campo (ore) per ogni trattamento.
-- Da eseguire una volta sola in Supabase → SQL Editor. Si può rieseguire senza problemi.
alter table public.trattamenti add column if not exists carenza_giorni numeric;
alter table public.trattamenti add column if not exists rientro_ore numeric;
notify pgrst, 'reload schema';
