-- Scheda del lavoro nel volo (rilievo, agricoltura, pulizia): campi specifici salvati in un'unica colonna
alter table public.voli add column if not exists dettagli jsonb;
