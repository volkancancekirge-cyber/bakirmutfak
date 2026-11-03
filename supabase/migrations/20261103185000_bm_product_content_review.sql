begin;
create table if not exists public.bm_product_content (
 product_id uuid primary key references public.bm_source_catalog(id) on delete cascade,
 short_description text not null default '' check (char_length(short_description)<=700),
 description text not null default '' check (char_length(description)<=6000),
 specifications jsonb not null default '{}'::jsonb check (jsonb_typeof(specifications)='object' and pg_column_size(specifications)<=8192),
 source_kind text not null default 'manual_review' check (source_kind in ('supplier_page','supplier_document','manual_review')),
 review_status text not null default 'draft' check (review_status in ('draft','approved')),
 updated_at timestamptz not null default now(),
 constraint bm_content_approved_complete check (review_status<>'approved' or char_length(trim(description))>=80)
);
create index if not exists bm_product_content_status_idx on public.bm_product_content (review_status);
alter table public.bm_product_content enable row level security;
drop policy if exists bm_product_content_public_approved on public.bm_product_content;
create policy bm_product_content_public_approved on public.bm_product_content
 for select to anon,authenticated using (review_status='approved');
drop policy if exists bm_product_content_admin_read on public.bm_product_content;
create policy bm_product_content_admin_read on public.bm_product_content
 for select to authenticated using ((select private.bm_is_admin()));
drop policy if exists bm_product_content_admin_insert on public.bm_product_content;
create policy bm_product_content_admin_insert on public.bm_product_content
 for insert to authenticated with check ((select private.bm_is_admin()));
drop policy if exists bm_product_content_admin_update on public.bm_product_content;
create policy bm_product_content_admin_update on public.bm_product_content
 for update to authenticated using ((select private.bm_is_admin()))
 with check ((select private.bm_is_admin()));
revoke all on public.bm_product_content from public,anon,authenticated;
grant select on public.bm_product_content to anon,authenticated;
grant insert,update on public.bm_product_content to authenticated;
commit;