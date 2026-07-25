-- Foto de perfil de la cuenta de autoservicio (Supabase Storage) — el usuario
-- ve su nombre/foto en el sidebar y puede editarlos en /perfil.

alter table user_profile add column if not exists avatar_url text;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Lectura pública (son fotos de perfil, no datos sensibles) — escritura solo
-- del propio dueño, en una carpeta con su auth_user_id como prefijo
-- (ej. avatars/<auth_user_id>/foto.jpg), igual al patrón ya usado para RLS
-- de user_profile (auth.uid() = auth_user_id).
create policy avatars_public_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_own_write on storage.objects
  for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_update on storage.objects
  for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy avatars_own_delete on storage.objects
  for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
