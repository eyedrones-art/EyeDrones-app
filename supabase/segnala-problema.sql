-- EyeDrones — «⚠️ Segnala un problema» su un lavoro confermato di «Trova un pilota».
-- Il pilota segnala che il cliente non paga o è sparito; il cliente che il pilota non si è presentato o non consegna.
-- La segnalazione resta salvata e Ivan riceve un avviso su Telegram (senza nomi, email o telefoni).
-- Serve trova-pilota.sql già eseguito. Da eseguire una volta: SQL Editor → New query → incolla tutto → Run. Si può rieseguire.

create table if not exists public.segnalazioni_lavoro (
  id uuid primary key default gen_random_uuid(),
  richiesta_id uuid not null references public.richieste_zona(id) on delete cascade,
  offerta_id uuid references public.offerte_zona(id) on delete set null,
  chi text not null check (chi in ('pilota', 'cliente')),
  motivo text not null check (motivo in ('non_paga', 'sparito', 'non_presentato', 'non_consegna', 'altro')),
  nota text,
  gestita boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists segnalazioni_lavoro_richiesta on public.segnalazioni_lavoro (richiesta_id);
-- nessuno la legge dall'app: solo con le funzioni qui sotto (e Ivan dal pannello di Supabase)
alter table public.segnalazioni_lavoro enable row level security;
revoke all on public.segnalazioni_lavoro from anon, authenticated;

-- il pilota del lavoro confermato
create or replace function public.segnala_problema_pilota(p_richiesta uuid, p_motivo text, p_nota text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona; v_z public.richieste_zona;
begin
  if p_motivo not in ('non_paga', 'sparito', 'altro') then raise exception 'motivo non valido'; end if;
  select * into v_o from public.offerte_zona where richiesta_id = p_richiesta and user_id = auth.uid() and stato = 'confermata';
  if not found then raise exception 'lavoro non trovato'; end if;
  select * into v_z from public.richieste_zona where id = v_o.richiesta_id;
  -- al massimo 3 segnalazioni per lavoro e per parte
  if (select count(*) from public.segnalazioni_lavoro where richiesta_id = v_z.id and chi = 'pilota') >= 3 then raise exception 'troppe segnalazioni'; end if;
  insert into public.segnalazioni_lavoro (richiesta_id, offerta_id, chi, motivo, nota)
    values (v_z.id, v_o.id, 'pilota', p_motivo, nullif(left(privato.senza_contatti(btrim(coalesce(p_nota, ''))), 500), ''));
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'problema', 'chi', 'pilota', 'motivo', p_motivo,
    'servizio', v_z.servizio, 'provincia', v_z.provincia, 'prezzo', v_o.prezzo));
  return true;
end;
$$;
revoke all on function public.segnala_problema_pilota(uuid, text, text) from public;
grant execute on function public.segnala_problema_pilota(uuid, text, text) to authenticated;

-- il cliente, con il codice del suo link privato
create or replace function public.segnala_problema_cliente(p_codice text, p_motivo text, p_nota text)
returns boolean
language plpgsql volatile security definer set search_path = public
as $$
declare v_o public.offerte_zona; v_z public.richieste_zona;
begin
  if p_motivo not in ('non_presentato', 'non_consegna', 'altro') then raise exception 'motivo non valido'; end if;
  select * into v_z from public.richieste_zona where codice = p_codice and stato = 'confermata';
  if not found then raise exception 'lavoro non trovato'; end if;
  select * into v_o from public.offerte_zona where richiesta_id = v_z.id and stato = 'confermata' limit 1;
  if (select count(*) from public.segnalazioni_lavoro where richiesta_id = v_z.id and chi = 'cliente') >= 3 then raise exception 'troppe segnalazioni'; end if;
  insert into public.segnalazioni_lavoro (richiesta_id, offerta_id, chi, motivo, nota)
    values (v_z.id, v_o.id, 'cliente', p_motivo, nullif(left(privato.senza_contatti(btrim(coalesce(p_nota, ''))), 500), ''));
  perform privato.avvisa_lavori(jsonb_build_object('tipo', 'problema', 'chi', 'cliente', 'motivo', p_motivo,
    'servizio', v_z.servizio, 'provincia', v_z.provincia, 'prezzo', v_o.prezzo));
  return true;
end;
$$;
revoke all on function public.segnala_problema_cliente(text, text, text) from public;
grant execute on function public.segnala_problema_cliente(text, text, text) to anon, authenticated;

-- per Ivan: le segnalazioni da guardare
-- select s.created_at, s.chi, s.motivo, s.nota, r.servizio, r.provincia, r.nome as cliente, r.email as email_cliente
--   from public.segnalazioni_lavoro s join public.richieste_zona r on r.id = s.richiesta_id where not s.gestita order by s.created_at desc;
