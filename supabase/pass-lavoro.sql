-- Eyedrones — Pass Lavoro e protezione dei campi legati ai pagamenti
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi.

-- data di acquisto del Pass Lavoro sul singolo volo (vuota = nessun pass)
alter table public.voli add column if not exists pass_lavoro timestamptz;

-- Protezione: dall'app (utenti collegati) non si possono cambiare il piano del profilo né il Pass di un volo.
-- Li cambi tu da Supabase (Table Editor o SQL Editor) o, più avanti, il sistema dei pagamenti.
create or replace function public.proteggi_campi_pagamento()
returns trigger
language plpgsql
as $$
begin
  if coalesce(auth.role(), '') in ('authenticated', 'anon') then
    if tg_table_name = 'profili' then
      if tg_op = 'INSERT' then
        if new.piano is not null and new.piano <> 'free' then new.piano := 'free'; end if;
      else
        new.piano := old.piano;
      end if;
    elsif tg_table_name = 'voli' then
      if tg_op = 'INSERT' then
        new.pass_lavoro := null;
      else
        new.pass_lavoro := old.pass_lavoro;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists proteggi_piano on public.profili;
create trigger proteggi_piano before insert or update on public.profili
  for each row execute function public.proteggi_campi_pagamento();

drop trigger if exists proteggi_pass on public.voli;
create trigger proteggi_pass before insert or update on public.voli
  for each row execute function public.proteggi_campi_pagamento();

-- Per sbloccare a mano un Pass (finché i pagamenti non sono automatici), dopo la richiesta del cliente:
--   update public.voli set pass_lavoro = now() where id = 'CODICE-DEL-VOLO';
-- Per cambiare il piano di un utente:
--   update public.profili set piano = 'pro' where email = 'nome@esempio.it';
