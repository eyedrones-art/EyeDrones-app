-- EYEDRONES — «Trova un pilota»: richieste troppo vaghe (manca il comune o due righe di descrizione).
-- 1) il cliente riceve un'email automatica «ci servono alcuni dettagli» con il link alla sua richiesta (/offerte/<codice>#dettagli)
-- 2) lì aggiunge comune, data e cosa gli serve: la richiesta si aggiorna e i piloti la vedono completa
-- 3) a te arriva solo l'avviso Telegram (niente nome, email o telefono del cliente)
-- Serve aver già eseguito trova-pilota.sql. Da eseguire una volta: SQL Editor → Run. Si può rieseguire.

alter table public.richieste_zona add column if not exists dettagli_chiesti timestamptz;  -- quando abbiamo mandato l'email
alter table public.richieste_zona add column if not exists dettagli_aggiunti timestamptz; -- quando il cliente li ha aggiunti

-- è troppo vaga? (manca il posto oppure la descrizione è più corta di due righe)
create or replace function privato.richiesta_vaga(p_z public.richieste_zona)
returns boolean language sql stable as $$
  select coalesce(btrim(p_z.luogo), '') = '' or length(btrim(coalesce(p_z.descrizione, ''))) < 15;
$$;

-- manda l'email alle richieste aperte e vaghe degli ultimi 30 giorni (una sola volta per richiesta) → quante email
create or replace function privato.chiedi_dettagli()
returns int language plpgsql security definer set search_path = public as $$
declare r public.richieste_zona; n int := 0;
begin
  for r in
    select * from public.richieste_zona z
    where z.stato = 'aperta' and z.dettagli_chiesti is null
      and z.created_at > now() - interval '30 days' and z.created_at < now() - interval '10 minutes'
      and privato.richiesta_vaga(z)
    order by z.created_at limit 30
  loop
    perform privato.avvisa_lavori(jsonb_build_object('tipo', 'chiedi_dettagli', 'a', r.email, 'nome', r.nome,
      'codice', r.codice, 'servizio', r.servizio, 'cliente', privato.codice_cliente(r.email)));
    update public.richieste_zona set dettagli_chiesti = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function privato.chiedi_dettagli() from public, anon, authenticated;

-- il cliente aggiunge i dettagli dalla sua pagina (con il codice segreto della richiesta)
create or replace function public.completa_richiesta_zona(p_codice text, p_luogo text, p_data date, p_descrizione text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_z public.richieste_zona;
begin
  if p_codice is null or p_codice !~ '^[a-f0-9]{32,64}$' then raise exception 'Richiesta non trovata'; end if;
  if length(btrim(coalesce(p_luogo, ''))) < 2 then raise exception 'luogo mancante'; end if;
  if length(btrim(coalesce(p_descrizione, ''))) < 15 then raise exception 'descrizione mancante'; end if;
  update public.richieste_zona set
    luogo = left(btrim(p_luogo), 120),
    descrizione = left(btrim(p_descrizione), 2000),
    data_desiderata = case when p_data >= current_date and p_data < current_date + 730 then p_data else data_desiderata end,
    dettagli_aggiunti = now()
  where codice = p_codice and stato = 'aperta'
  returning * into v_z;
  if not found then raise exception 'Richiesta non trovata'; end if;
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'dettagli_aggiunti', 'provincia', v_z.provincia,
    'servizio', v_z.servizio, 'luogo', v_z.luogo));
  return true;
end $$;
revoke all on function public.completa_richiesta_zona(text, text, date, text) from public;
grant execute on function public.completa_richiesta_zona(text, text, date, text) to anon, authenticated;

-- ogni giorno alle 10:17 controlla le richieste nuove (il modulo ora chiede già i dettagli: serve per i casi rimasti)
select cron.unschedule('eyedrones-chiedi-dettagli') where exists (select 1 from cron.job where jobname = 'eyedrones-chiedi-dettagli');
select cron.schedule('eyedrones-chiedi-dettagli', '17 10 * * *', 'select privato.chiedi_dettagli()');

-- subito: manda l'email alle richieste vaghe di adesso (es. Brescia) e dice quante
select privato.chiedi_dettagli() as email_mandate;
