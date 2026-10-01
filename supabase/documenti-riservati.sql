-- Eyedrones — spazio riservato per documenti e liberatorie
-- Da eseguire una volta in Supabase: SQL Editor → New query → incolla tutto → Run.
-- Si può rieseguire senza problemi.
-- Crea il contenitore privato "documenti-privati": ogni utente vede e gestisce solo la propria cartella
-- (il nome della cartella è il suo id). I file si aprono solo con link temporanei generati dall'app.

insert into storage.buckets (id, name, public)
values ('documenti-privati', 'documenti-privati', false)
on conflict (id) do update set public = false;

drop policy if exists "documenti_privati_select" on storage.objects;
drop policy if exists "documenti_privati_insert" on storage.objects;
drop policy if exists "documenti_privati_update" on storage.objects;
drop policy if exists "documenti_privati_delete" on storage.objects;

create policy "documenti_privati_select" on storage.objects for select to authenticated
  using (bucket_id = 'documenti-privati' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documenti_privati_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'documenti-privati' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documenti_privati_update" on storage.objects for update to authenticated
  using (bucket_id = 'documenti-privati' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'documenti-privati' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "documenti_privati_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'documenti-privati' and (storage.foldername(name))[1] = auth.uid()::text);
