-- Bakır Mutfak / Supabase PostgreSQL development schema
-- Run ONCE in your own Supabase project SQL editor, after reviewing.
-- Payment and order tables intentionally NOT implemented.
begin;
create extension if not exists pgcrypto;

create table if not exists public.bm_admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor')),
  created_at timestamptz not null default now()
);

create or replace function public.bm_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.bm_admin_users
    where user_id = (select auth.uid())
      and role in ('owner', 'editor')
  );
$$;
revoke all on function public.bm_is_admin() from public;
grant execute on function public.bm_is_admin() to authenticated;

create table if not exists public.bm_products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique check (length(sku) between 2 and 120 and sku ~ '^[A-Za-z0-9][A-Za-z0-9_-]*$'),
  slug text not null unique check (length(slug) between 3 and 180 and slug ~ '^[a-z0-9-]+$'),
  name text not null check (length(name) between 2 and 250),
  category text not null default 'sofra' check (category in ('cezve','caydanlik','tencere','sofra')),
  product_type text not null default 'cezve' check (product_type in ('cezve','caydanlik','tencere','tepsi','sahan','fincan','set','surahi')),
  price numeric(12,2) not null check (price > 0 and price < 100000000),
  stock integer not null default 0 check (stock between 0 and 1000000),
  published boolean not null default false,
  handmade boolean not null default false,
  tinned boolean not null default false,
  image_urls text[] not null default '{}',
  material text not null default '',
  size_label text not null default '',
  subtitle text not null default '',
  description text not null default '',
  variants text[] not null default '{}',
  badge text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint image_limit check (cardinality(image_urls) <= 8)
);

create or replace function public.bm_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists bm_products_touch_updated_at on public.bm_products;
create trigger bm_products_touch_updated_at before update on public.bm_products
for each row execute procedure public.bm_touch_updated_at();

create table if not exists public.bm_import_audit (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id),
  source_name text not null,
  row_count integer not null check (row_count >= 0),
  inserted_count integer not null check (inserted_count >= 0),
  updated_count integer not null check (updated_count >= 0),
  notes text not null default '',
  created_at timestamptz not null default now()
);

alter table public.bm_admin_users enable row level security;
alter table public.bm_products enable row level security;
alter table public.bm_import_audit enable row level security;

drop policy if exists "bm_admin_read_self" on public.bm_admin_users;
create policy "bm_admin_read_self" on public.bm_admin_users
for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "bm_public_can_read_published" on public.bm_products;
create policy "bm_public_can_read_published" on public.bm_products
for select to anon, authenticated using (published = true OR (select public.bm_is_admin()));

drop policy if exists "bm_admin_can_insert" on public.bm_products;
create policy "bm_admin_can_insert" on public.bm_products
for insert to authenticated with check ((select public.bm_is_admin()));

drop policy if exists "bm_admin_can_update" on public.bm_products;
create policy "bm_admin_can_update" on public.bm_products
for update to authenticated
using ((select public.bm_is_admin()))
with check ((select public.bm_is_admin()));

drop policy if exists "bm_admin_can_delete" on public.bm_products;
create policy "bm_admin_can_delete" on public.bm_products
for delete to authenticated using ((select public.bm_is_admin()));

drop policy if exists "bm_audit_read" on public.bm_import_audit;
create policy "bm_audit_read" on public.bm_import_audit
for select to authenticated using ((select public.bm_is_admin()));

drop policy if exists "bm_audit_insert" on public.bm_import_audit;
create policy "bm_audit_insert" on public.bm_import_audit
for insert to authenticated
with check ((select public.bm_is_admin()) and admin_id = (select auth.uid()));

revoke all on public.bm_admin_users from anon, authenticated;
revoke all on public.bm_products from anon, authenticated;
revoke all on public.bm_import_audit from anon, authenticated;
grant select on public.bm_admin_users to authenticated;
grant select on public.bm_products to anon, authenticated;
grant insert, update, delete on public.bm_products to authenticated;
grant select, insert on public.bm_import_audit to authenticated;

create index if not exists bm_products_category_idx on public.bm_products(category) where published = true;
create index if not exists bm_products_published_idx on public.bm_products(published, created_at desc);
create index if not exists bm_import_audit_created_at_idx on public.bm_import_audit(created_at desc);
commit;

-- ADMIN BOOTSTRAP (manual, in Supabase SQL editor; replace email below):
-- 1) Supabase -> Authentication -> Users -> Add user (verified email & strong password)
-- 2) Run ONLY AFTER you know the owner email:
-- INSERT INTO public.bm_admin_users(user_id, role)
-- SELECT id, 'owner' FROM auth.users WHERE email = 'YOUR_EMAIL_HERE'
-- ON CONFLICT (user_id) DO UPDATE SET role = 'owner';
-- Never insert keys or user passwords into this SQL file.
