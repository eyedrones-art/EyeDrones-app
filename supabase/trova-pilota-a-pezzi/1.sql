-- Trova un pilota, pezzo 1 di 5. Lanciali in ordine, uno alla volta (si possono rilanciare).
-- Eyedrones — «Trova un pilota» (app.eyedrones.it/trova-pilota): il cliente scrive cosa gli serve, i piloti della sua
-- provincia mandano un'offerta, il cliente sceglie, il pilota scelto conferma (e paga la commissione, se è accesa)
-- e solo allora i due si vedono i contatti.
-- Richiede di aver già eseguito «pagina-pilota.sql» e «avviso-richieste-email.sql» (per le email e il codice segreto).
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run. Si può rieseguire senza problemi.
--
-- Come funziona
-- 1) il cliente invia la richiesta (invia_richiesta_zona): riceve per email il link privato alle offerte
-- 2) i piloti della provincia con «La mia pagina» attiva la vedono SENZA contatti (lavori_in_zona) e mandano un'offerta
--    (invia_offerta_zona): prezzo, cosa comprende (video, foto, consegna, permessi…) e messaggio. Al massimo 8 per richiesta
-- 3) il cliente apre il link (offerte_cliente) e sceglie un'offerta (scegli_offerta)
-- 4) il pilota scelto conferma entro 48 ore (conferma_lavoro_zona). Con la commissione a 0 conferma e basta; se è accesa
--    paga con Stripe (funzione Netlify lavoro-pagamento) e la conferma arriva da stripe-webhook (conferma_lavoro_pagato)
-- 5) confermato: il pilota trova la richiesta con i contatti tra le sue richieste («Crea preventivo»), il cliente vede
--    i contatti del pilota. Se il pilota non conferma in 48 ore la scelta decade e il cliente può sceglierne un altro;
--    chi lascia decadere 2 scelte non riceve più richieste in zona
--
-- 6) «I miei lavori» (/miei-lavori): il cliente ritrova tutte le sue richieste con il link personale che riceve solo per
--    email; dai lavori confermati può «richiedere di nuovo» lo stesso pilota (la richiesta va solo a lui)
-- 7) il pilota consegna il lavoro (galleria, link o report): il cliente riceve un'email e dopo 2 giorni gli chiediamo
--    le stelle; le stelle si vedono nelle offerte, nell'elenco dei piloti e nella pagina del pilota
--
-- La commissione si cambia qui sotto, in privato.impostazioni (lavori_commissione_*): 5% del prezzo, minimo 5 €,
-- massimo 50 €. All'inizio è SPENTA (lavori_commissione_attiva = 'no'): non paga nessuno. Per accenderla:
--   update privato.impostazioni set valore = 'si' where chiave = 'lavori_commissione_attiva';

create extension if not exists pg_net;
create schema if not exists privato;
revoke all on schema privato from public, anon, authenticated;
create table if not exists privato.impostazioni (chiave text primary key, valore text not null);
revoke all on privato.impostazioni from public, anon, authenticated;

insert into privato.impostazioni (chiave, valore) values
  ('lavori_url', 'https://app.eyedrones.it/.netlify/functions/avviso-lavori'),
  ('lavori_commissione_attiva', 'no'),    -- 'si' = i piloti pagano la commissione sui lavori ottenuti
  ('lavori_commissione_percento', '5'),   -- 5 = 5% dell'offerta
  ('lavori_commissione_minimo', '5'),     -- euro
  ('lavori_commissione_massimo', '50')    -- euro
on conflict (chiave) do nothing;

-- 1) colonne nuove sulle tabelle della pagina pilota
alter table public.pagine_pilota add column if not exists in_elenco boolean not null default true;   -- compare in «Trova un pilota»
alter table public.pagine_pilota add column if not exists scelte_decadute int not null default 0;     -- scelto ma non ha confermato
alter table public.pagine_pilota add column if not exists escluso_trova boolean not null default false; -- ha preso il lavoro fuori da EyeDrones
alter table public.richieste_preventivo add column if not exists da_zona uuid;                        -- arrivata da «Trova un pilota»
create unique index if not exists richieste_preventivo_zona_idx on public.richieste_preventivo (user_id, da_zona) where da_zona is not null;

-- 2) le richieste dei clienti e le offerte dei piloti: nessuno le legge direttamente, solo tramite le funzioni qui sotto
create table if not exists public.richieste_zona (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')), -- link privato del cliente
  provincia text not null,
  nome text not null,
  email text not null,
  telefono text,
  servizio text,
  luogo text,
  data_desiderata date,
  descrizione text,
  stato text not null default 'aperta',      -- aperta | scelta | confermata | chiusa
  offerta_scelta uuid,
  scelta_il timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists richieste_zona_provincia_idx on public.richieste_zona (provincia, created_at desc);
-- il punto del lavoro, arrotondato a circa 100 m: il pilota vede dov'è e controlla le zone con il suo file D-Flight
alter table public.richieste_zona add column if not exists lat numeric(8,3);
alter table public.richieste_zona add column if not exists lon numeric(8,3);
-- il punto esatto (circa 1 m): i piloti della provincia lo vedono (non è un contatto) per controllare zone e categoria
alter table public.richieste_zona add column if not exists lat_esatta numeric(9,5);
alter table public.richieste_zona add column if not exists lon_esatta numeric(9,5);
-- quanto pensa di spendere il cliente (facoltativo): fino_300 | 300_700 | 700_1500 | oltre_1500
alter table public.richieste_zona add column if not exists budget text;
-- «Richiedi di nuovo»: la richiesta va solo al pilota con cui il cliente ha già lavorato
alter table public.richieste_zona add column if not exists pilota_diretto uuid references auth.users(id) on delete set null;
create index if not exists richieste_zona_email_idx on public.richieste_zona (email, created_at desc);
alter table public.richieste_zona enable row level security;
revoke all on public.richieste_zona from anon, authenticated;

create table if not exists public.offerte_zona (
  id uuid primary key default gen_random_uuid(),
  richiesta_id uuid not null references public.richieste_zona(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prezzo numeric(10,2) not null,
  messaggio text,
  stato text not null default 'inviata',     -- inviata | scelta | confermata | decaduta | rinunciata | non_scelta
  commissione numeric(10,2),                 -- calcolata quando il cliente sceglie
  pagata_sessione text unique,               -- sessione Stripe (niente conferme doppie)
  confermata_il timestamptz,
  created_at timestamptz not null default now(),
  unique (richiesta_id, user_id)
);
alter table public.offerte_zona add column if not exists da_rimborsare boolean not null default false; -- pagata ma non più possibile
alter table public.offerte_zona add column if not exists contatto_fuori boolean;
-- cosa comprende l'offerta, per il cliente: { video_min, foto, reel, consegna_giorni, permessi, sopralluogo }
alter table public.offerte_zona add column if not exists dettagli jsonb not null default '{}';
-- il pilota scelto dice «non posso farlo» (zona, categoria, persone…): nessuna penalità, il cliente sceglie un altro
alter table public.offerte_zona add column if not exists motivo_rinuncia text;                         -- scelta decaduta: il pilota ha contattato il cliente lo stesso?
create index if not exists offerte_zona_user_idx on public.offerte_zona (user_id, created_at desc);
-- la consegna del lavoro (link alla galleria, a Drive/WeTransfer o al report) e le stelle del cliente
alter table public.offerte_zona add column if not exists consegna jsonb;                 -- { link, nota }
alter table public.offerte_zona add column if not exists consegnata_il timestamptz;
alter table public.offerte_zona add column if not exists stelle smallint check (stelle between 1 and 5);
alter table public.offerte_zona add column if not exists recensione text;
alter table public.offerte_zona add column if not exists recensione_il timestamptz;
alter table public.offerte_zona add column if not exists recensione_chiesta timestamptz; -- email «com'è andata?» mandata
alter table public.offerte_zona enable row level security;
revoke all on public.offerte_zona from anon, authenticated;

-- «I miei lavori»: un link personale per ogni email di cliente; arriva solo per email, mai sullo schermo
create table if not exists public.clienti_zona (
  email text primary key,
  codice text not null unique default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  link_inviato timestamptz,
  created_at timestamptz not null default now()
);
alter table public.clienti_zona enable row level security;
revoke all on public.clienti_zona from anon, authenticated;

