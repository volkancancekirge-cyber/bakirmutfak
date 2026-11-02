-- Bakır Mutfak: private review gallery for images from approved supplier sites.
-- This is NOT the retail products table; it has no sales price or stock.
begin;

create table if not exists public.bm_product_candidates (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique
    check (char_length(source_url) between 16 and 2048 and source_url ~ '^https://'),
  source_host text not null
    check (source_host in ('bakirbul.com','thecoppery.com')),
  supplier_sku text unique
    check (supplier_sku is null or supplier_sku ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$'),
  name text not null check (char_length(name) between 2 and 250),
  image_urls text[] not null default '{}',
  source_image_urls text[] not null default '{}',
  review_status text not null default 'needs_review'
    check (review_status in ('needs_review', 'accepted', 'rejected')),
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bm_candidate_image_count check (cardinality(image_urls) <= 8),
  constraint bm_candidate_source_image_count check (cardinality(source_image_urls) <= 8)
);

create index if not exists bm_product_candidates_created_at_idx
  on public.bm_product_candidates(created_at desc);

alter table public.bm_product_candidates enable row level security;
drop policy if exists bm_candidates_admin_read on public.bm_product_candidates;
create policy bm_candidates_admin_read on public.bm_product_candidates
  for select to authenticated using ((select private.bm_is_admin()));
drop policy if exists bm_candidates_admin_insert on public.bm_product_candidates;
create policy bm_candidates_admin_insert on public.bm_product_candidates
  for insert to authenticated with check ((select private.bm_is_admin()));
drop policy if exists bm_candidates_admin_update on public.bm_product_candidates;
create policy bm_candidates_admin_update on public.bm_product_candidates
  for update to authenticated
  using ((select private.bm_is_admin()))
  with check ((select private.bm_is_admin()));

revoke all on public.bm_product_candidates from anon, authenticated;
grant select, insert, update on public.bm_product_candidates to authenticated;

drop policy if exists bm_admin_upload_candidate_images on storage.objects;
create policy bm_admin_upload_candidate_images
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'bm-product-images'
    and (select private.bm_is_admin())
    and (storage.foldername(name))[1] = 'candidates'
  );

commit;