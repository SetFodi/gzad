-- ad-media is a public bucket, so every file is served by its URL without any
-- policy. The broad SELECT policy only added the ability for anyone to list
-- the whole bucket, including other clients' unapproved or rejected creative.
-- Uploads (INSERT without upsert) and public URLs don't need SELECT; owners and
-- admins keep read access to their own objects.

drop policy if exists "Anyone can view ad media" on storage.objects;

create policy "Owners and admins can read ad media" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'ad-media'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] in (
        select clients.id::text from public.clients where clients.auth_user_id = (select auth.uid())
      )
    )
  );
