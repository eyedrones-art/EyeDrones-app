-- Codice di condotta dei piloti di «Trova un pilota»: accordo tra pilota ed EyeDrones, il pilota lo firma
-- dalla sua pagina (non si mostra ai clienti). Da lanciare dopo pagina-pilota.sql e trova-pilota.sql.

alter table public.pagine_pilota add column if not exists codice_firmato_il timestamptz;  -- quando il pilota ha firmato
