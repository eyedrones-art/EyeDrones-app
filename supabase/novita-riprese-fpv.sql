-- Eyedrones — FPV nel registro voli, galleria cliente con preferiti/PIN/filigrana, liberatorie
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi. Richiede di aver già eseguito «condivisioni-galleria.sql».

-- 1) voli FPV: osservatore, visore, canale video
alter table public.voli add column if not exists osservatore boolean;
alter table public.voli add column if not exists visore text;
alter table public.voli add column if not exists canale_video text;

-- 2) galleria cliente: PIN, filigrana, download
alter table public.condivisioni add column if not exists pin text;
alter table public.condivisioni add column if not exists filigrana boolean not null default false;
alter table public.condivisioni add column if not exists download boolean not null default true;

-- foto e video che il cliente segna con il cuore
create table if not exists public.condivisioni_preferiti (
  condivisione_id uuid not null references public.condivisioni(id) on delete cascade,
  media_id text not null,
  created_at timestamptz not null default now(),
  primary key (condivisione_id, media_id)
);
alter table public.condivisioni_preferiti enable row level security;
drop policy if exists "preferiti_select_proprietario" on public.condivisioni_preferiti;
create policy "preferiti_select_proprietario" on public.condivisioni_preferiti for select
  using (exists (select 1 from public.condivisioni c where c.id = condivisione_id and c.user_id = auth.uid()));
-- il cliente scrive solo tramite la funzione galleria_preferito qui sotto

-- la vecchia versione aveva un solo parametro: la tolgo per evitare ambiguità
drop function if exists public.galleria_condivisa(uuid);

create or replace function public.galleria_condivisa(p_token uuid, p_pin text default null)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  c public.condivisioni;
begin
  select * into c from public.condivisioni
  where token = p_token and attiva and (scade_il is null or scade_il > now())
  limit 1;
  if not found then return null; end if;

  if c.pin is not null and c.pin <> '' and coalesce(p_pin, '') <> c.pin then
    return json_build_object('richiede_pin', true, 'pin_errato', p_pin is not null);
  end if;

  return (
    select json_build_object(
      'titolo', c.titolo,
      'messaggio', c.messaggio,
      'scade_il', c.scade_il,
      'filigrana', c.filigrana,
      'download', c.download,
      'data', v.data,
      'luogo', v.luogo,
      'azienda_nome', p.azienda_nome,
      'azienda_logo', p.azienda_logo,
      'preferiti', coalesce((select json_agg(f.media_id) from public.condivisioni_preferiti f where f.condivisione_id = c.id), '[]'::json),
      'media', coalesce((
        select json_agg(json_build_object('id', m.id, 'tipo', m.tipo, 'url', m.url, 'nome', m.nome) order by m.created_at)
        from public.voli_media m
        where m.volo_id::text = c.volo_id and m.tipo in ('foto', 'video', 'link')
      ), '[]'::json)
    )
    from public.voli v
    left join public.profili p on p.user_id = c.user_id
    where v.id::text = c.volo_id
  );
end;
$$;

create or replace function public.galleria_preferito(p_token uuid, p_pin text, p_media_id text, p_preferito boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  c public.condivisioni;
begin
  select * into c from public.condivisioni
  where token = p_token and attiva and (scade_il is null or scade_il > now())
  limit 1;
  if not found then return false; end if;
  if c.pin is not null and c.pin <> '' and coalesce(p_pin, '') <> c.pin then return false; end if;
  if not exists (select 1 from public.voli_media m where m.id::text = p_media_id and m.volo_id::text = c.volo_id) then return false; end if;

  if p_preferito then
    insert into public.condivisioni_preferiti (condivisione_id, media_id) values (c.id, p_media_id) on conflict do nothing;
  else
    delete from public.condivisioni_preferiti where condivisione_id = c.id and media_id = p_media_id;
  end if;
  return true;
end;
$$;

revoke all on function public.galleria_condivisa(uuid, text) from public;
revoke all on function public.galleria_preferito(uuid, text, text, boolean) from public;
grant execute on function public.galleria_condivisa(uuid, text) to anon, authenticated;
grant execute on function public.galleria_preferito(uuid, text, text, boolean) to anon, authenticated;

-- 3) liberatorie firmate (PDF salvato nello storage, collegato al volo)
create table if not exists public.liberatorie (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  volo_id text not null,
  tipo text not null,               -- persona | proprieta
  nome text not null,
  pdf_url text not null,
  pdf_percorso text,
  created_at timestamptz not null default now()
);
create index if not exists liberatorie_volo_idx on public.liberatorie (volo_id);
alter table public.liberatorie enable row level security;
drop policy if exists "liberatorie_select" on public.liberatorie;
drop policy if exists "liberatorie_insert" on public.liberatorie;
drop policy if exists "liberatorie_delete" on public.liberatorie;
create policy "liberatorie_select" on public.liberatorie for select using (auth.uid() = user_id);
create policy "liberatorie_insert" on public.liberatorie for insert
  with check (auth.uid() = user_id and exists (select 1 from public.voli v where v.id::text = volo_id));
create policy "liberatorie_delete" on public.liberatorie for delete using (auth.uid() = user_id);
