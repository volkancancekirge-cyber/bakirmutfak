-- Bakır Mutfak public catalog photos; writes limited to verified admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bm-product-images', 'bm-product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

drop policy if exists "bm_admin_upload_product_images" on storage.objects;
create policy "bm_admin_upload_product_images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'bm-product-images'
  and (select private.bm_is_admin())
  and (storage.foldername(name))[1] = 'products'
);
