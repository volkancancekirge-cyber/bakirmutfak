-- Approved source catalog import queue; idempotent and resumable.
-- All rows are non-purchasable; no prices or stock are inferred.
begin;
create table if not exists public.bm_catalog_queue (
 id uuid primary key default gen_random_uuid(),
 source_url text not null unique check (source_url ~ '^https://(bakirbul[.]com/urun/|thecoppery[.]com/tr/urun/)' and char_length(source_url)<=1800),
 source_host text not null check (source_host in ('bakirbul.com','thecoppery.com')),
 status text not null default 'pending' check (status in ('pending','imported','failed','skipped')),
 attempts integer not null default 0 check (attempts between 0 and 5),
 last_error text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bm_catalog_queue_pending_idx on public.bm_catalog_queue(status,created_at);
alter table public.bm_catalog_queue enable row level security;
drop policy if exists bm_catalog_queue_admin_select on public.bm_catalog_queue;
create policy bm_catalog_queue_admin_select on public.bm_catalog_queue
 for select to authenticated using ((select private.bm_is_admin()));
drop policy if exists bm_catalog_queue_admin_insert on public.bm_catalog_queue;
create policy bm_catalog_queue_admin_insert on public.bm_catalog_queue
 for insert to authenticated with check ((select private.bm_is_admin()));
drop policy if exists bm_catalog_queue_admin_update on public.bm_catalog_queue;
create policy bm_catalog_queue_admin_update on public.bm_catalog_queue
 for update to authenticated using ((select private.bm_is_admin())) with check ((select private.bm_is_admin()));
revoke all on public.bm_catalog_queue from anon,authenticated;
grant select,insert,update on public.bm_catalog_queue to authenticated;

create table if not exists public.bm_source_catalog (
 id uuid primary key default gen_random_uuid(),
 source_url text not null unique check (source_url ~ '^https://' and char_length(source_url)<=1800),
 source_host text not null check (source_host in ('bakirbul.com','thecoppery.com')),
 supplier_sku text check (supplier_sku is null or supplier_sku ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$'),
 name text not null check (char_length(name) between 2 and 250),
 category text not null default 'sofra' check (category in ('cezve','caydanlik','tencere','sofra')),
 image_urls text[] not null default '{}' check (cardinality(image_urls) between 0 and 8),
 visibility text not null default 'review' check (visibility in ('review','visible','hidden')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bm_source_catalog_visibility_idx on public.bm_source_catalog(visibility,category,created_at desc);
create unique index if not exists bm_source_catalog_supplier_sku_uidx on public.bm_source_catalog(supplier_sku) where supplier_sku is not null;
alter table public.bm_source_catalog enable row level security;
drop policy if exists bm_source_catalog_public on public.bm_source_catalog;
create policy bm_source_catalog_public on public.bm_source_catalog
 for select to anon using (visibility = 'visible' and cardinality(image_urls)>0);
drop policy if exists bm_source_catalog_admin_select on public.bm_source_catalog;
create policy bm_source_catalog_admin_select on public.bm_source_catalog
 for select to authenticated using (visibility='visible' or (select private.bm_is_admin()));
drop policy if exists bm_source_catalog_admin_insert on public.bm_source_catalog;
create policy bm_source_catalog_admin_insert on public.bm_source_catalog
 for insert to authenticated with check ((select private.bm_is_admin()));
drop policy if exists bm_source_catalog_admin_update on public.bm_source_catalog;
create policy bm_source_catalog_admin_update on public.bm_source_catalog
 for update to authenticated using ((select private.bm_is_admin())) with check ((select private.bm_is_admin()));
revoke all on public.bm_source_catalog from anon, authenticated;
grant select on public.bm_source_catalog to anon;
grant select,insert,update on public.bm_source_catalog to authenticated;
commit;