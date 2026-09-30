-- Eyedrones — link di consegna al cliente (galleria condivisa di un volo)
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi.

create table if not exists public.condivisioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  volo_id text not null,            -- id del volo (testo, così funziona qualunque sia il tipo della colonna voli.id)
  token uuid not null unique default gen_random_uuid(),
  titolo text,
  messaggio text,
  scade_il timestamptz,             -- null = nessuna scadenza
  attiva boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists condivisioni_volo_idx on public.condivisioni (volo_id);

alter table public.condivisioni enable row level security;

-- ogni pilota vede e gestisce solo i propri link, e può condividere solo voli che può già vedere
drop policy if exists "condivisioni_select" on public.condivisioni;
drop policy if exists "condivisioni_insert" on public.condivisioni;
drop policy if exists "condivisioni_update" on public.condivisioni;
drop policy if exists "condivisioni_delete" on public.condivisioni;
create policy "condivisioni_select" on public.condivisioni for select using (auth.uid() = user_id);
create policy "condivisioni_insert" on public.condivisioni for insert
  with check (auth.uid() = user_id and exists (select 1 from public.voli v where v.id::text = volo_id));
create policy "condivisioni_update" on public.condivisioni for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "condivisioni_delete" on public.condivisioni for delete using (auth.uid() = user_id);

-- pagina pubblica: dato il token restituisce SOLO la galleria di quel volo (se il link è attivo e non scaduto).
-- security definer = legge i dati senza aprire a tutti le tabelle voli / voli_media / profili.
create or replace function public.galleria_condivisa(p_token uuid)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'titolo', c.titolo,
    'messaggio', c.messaggio,
    'scade_il', c.scade_il,
    'data', v.data,
    'luogo', v.luogo,
    'azienda_nome', p.azienda_nome,
    'azienda_logo', p.azienda_logo,
    'media', coalesce((
      select json_agg(json_build_object('id', m.id, 'tipo', m.tipo, 'url', m.url, 'nome', m.nome) order by m.created_at)
      from public.voli_media m
      where m.volo_id::text = c.volo_id
    ), '[]'::json)
  )
  from public.condivisioni c
  join public.voli v on v.id::text = c.volo_id
  left join public.profili p on p.user_id = c.user_id
  where c.token = p_token
    and c.attiva
    and (c.scade_il is null or c.scade_il > now())
  limit 1;
$$;

revoke all on function public.galleria_condivisa(uuid) from public;
grant execute on function public.galleria_condivisa(uuid) to anon, authenticated;
