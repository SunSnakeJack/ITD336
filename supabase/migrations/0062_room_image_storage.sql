-- Public room images with write access limited to room managers.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('room-images','room-images',true,5242880,array['image/jpeg','image/png','image/webp','image/gif'])
on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "public read room images" on storage.objects for select to public using(bucket_id='room-images');
create policy "room managers upload room images" on storage.objects for insert to authenticated with check(bucket_id='room-images' and public.has_permission('ROOM_MANAGE'));
create policy "room managers update room images" on storage.objects for update to authenticated using(bucket_id='room-images' and public.has_permission('ROOM_MANAGE')) with check(bucket_id='room-images' and public.has_permission('ROOM_MANAGE'));
create policy "room managers delete room images" on storage.objects for delete to authenticated using(bucket_id='room-images' and public.has_permission('ROOM_MANAGE'));
