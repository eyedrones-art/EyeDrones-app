-- Ortaly — «Oggi al banco»: il produttore tocca i prodotti che ha oggi e i clienti vedono quando ha aggiornato il banco.
-- Da eseguire una volta su Supabase ORTALY: SQL Editor → incolla → Run. Si può rieseguire.
alter table public.botteghe add column if not exists banco_aggiornato timestamptz;

-- ogni volta che un prodotto va al banco o ne esce, la bottega ricorda l'ora
create or replace function public.banco_toccato()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.disponibile is distinct from old.disponibile then
    update public.botteghe set banco_aggiornato = now() where id = new.bottega;
  end if;
  return new;
end $$;
drop trigger if exists banco_toccato on public.prodotti;
create trigger banco_toccato after insert or update of disponibile on public.prodotti
  for each row execute function public.banco_toccato();

-- la vetrina pubblica mostra anche l'ora dell'ultimo aggiornamento del banco (stesse colonne di prima + banco_aggiornato in fondo)
create or replace view public.vetrina_botteghe with (security_invoker = false) as
  select id, nome, paese, provincia, tipo, storia, foto, consegna_casa, ritiro, spedizione, bio, creata, pagamento,
         costo_casa, gratis_casa, costo_spedizione, gratis_spedizione, banco_aggiornato
  from public.botteghe
  where visibile and (abbonamento = 'attivo' or (abbonamento = 'prova' and prova_fino >= current_date));
grant select on public.vetrina_botteghe to anon, authenticated;

select 'Banco di oggi pronto' as fatto;
