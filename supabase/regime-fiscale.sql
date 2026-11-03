-- EyeDrones — regime fiscale del pilota nei preventivi (IVA, ritenuta d'acconto, rivalsa INPS, marca da bollo).
-- Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.

-- la scelta fatta in Impostazioni azienda: { regime, iva, rivalsa, ritenuta }
alter table public.profili add column if not exists regime_fiscale jsonb;

-- per ogni preventivo: il cliente è un privato o un'azienda/professionista (serve per la ritenuta d'acconto)
alter table public.preventivi add column if not exists cliente_tipo text;
alter table public.preventivi drop constraint if exists preventivi_cliente_tipo_check;
alter table public.preventivi add constraint preventivi_cliente_tipo_check check (cliente_tipo is null or cliente_tipo in ('privato', 'azienda'));
