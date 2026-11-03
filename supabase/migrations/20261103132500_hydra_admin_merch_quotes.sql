-- Hydra Commerce 2.0: public merchandising, admin-only curation, private quote inbox.
begin;

create table if not exists public.bm_hydra_settings (
 id smallint primary key default 1 check (id=1),
 hero_title text not null default 'Mutfağınıza bakırın en güzel hâli.' check (char_length(hero_title) between 8 and 90),
 hero_subtitle text not null default 'İster kahve ritüeli, ister günlük mutfak, ister özel sunum. Aradığınız bakır parçayı kategorisinde kolayca bulun.' check (char_length(hero_subtitle) between 12 and 350),
 hero_category text not null default 'tencere' check (hero_category in ('all','cezve','caydanlik','tencere','sunum','dekor','sofra')),
 featured_categories text[] not null default '{cezve,caydanlik,tencere,sunum,dekor}'::text[]
   check (cardinality(featured_categories) between 1 and 6 and featured_categories <@ '{cezve,caydanlik,tencere,sunum,dekor,sofra}'::text[]),
 updated_at timestamptz not null default now()
);
insert into public.bm_hydra_settings(id) values (1) on conflict (id) do nothing;
alter table public.bm_hydra_settings enable row level security;
drop policy if exists bm_hydra_settings_public_read on public.bm_hydra_settings;
create policy bm_hydra_settings_public_read on public.bm_hydra_settings
 for select to anon,authenticated using (true);
drop policy if exists bm_hydra_settings_admin_update on public.bm_hydra_settings;
create policy bm_hydra_settings_admin_update on public.bm_hydra_settings
 for update to authenticated using ((select private.bm_is_admin()))
 with check ((select private.bm_is_admin()));
revoke all on public.bm_hydra_settings from public,anon,authenticated;
grant select on public.bm_hydra_settings to anon,authenticated;
grant update(hero_title,hero_subtitle,hero_category,featured_categories,updated_at) on public.bm_hydra_settings to authenticated;

create table if not exists public.bm_hydra_merchandising (
 product_id uuid primary key references public.bm_source_catalog(id) on delete cascade,
 display_category text
   check (display_category is null or display_category in ('cezve','caydanlik','tencere','sunum','dekor','sofra')),
 featured boolean not null default false,
 sort_priority integer not null default 0 check (sort_priority between -1000 and 1000),
 hidden_from_storefront boolean not null default false,
 updated_at timestamptz not null default now()
);
create index if not exists bm_hydra_merch_featured_idx on public.bm_hydra_merchandising(featured,sort_priority desc);
alter table public.bm_hydra_merchandising enable row level security;
drop policy if exists bm_hydra_merch_public_read on public.bm_hydra_merchandising;
create policy bm_hydra_merch_public_read on public.bm_hydra_merchandising
 for select to anon,authenticated using (true);
drop policy if exists bm_hydra_merch_admin_insert on public.bm_hydra_merchandising;
create policy bm_hydra_merch_admin_insert on public.bm_hydra_merchandising
 for insert to authenticated with check ((select private.bm_is_admin()));
drop policy if exists bm_hydra_merch_admin_update on public.bm_hydra_merchandising;
create policy bm_hydra_merch_admin_update on public.bm_hydra_merchandising
 for update to authenticated using ((select private.bm_is_admin()))
 with check ((select private.bm_is_admin()));
revoke all on public.bm_hydra_merchandising from public,anon,authenticated;
grant select on public.bm_hydra_merchandising to anon,authenticated;
grant insert,update on public.bm_hydra_merchandising to authenticated;

create table if not exists public.bm_quote_requests (
 id uuid primary key default gen_random_uuid(),
 contact_name text not null check (char_length(contact_name) between 2 and 120),
 contact_email text not null check (char_length(contact_email) between 6 and 254 and contact_email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
 contact_phone text not null default '' check (char_length(contact_phone)<=30),
 message text not null default '' check (char_length(message)<=1500),
 items jsonb not null check (jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 20),
 privacy_accepted_at timestamptz not null,
 status text not null default 'new' check (status in ('new','reviewing','answered','closed')),
 admin_notes text not null default '' check (char_length(admin_notes)<=3000),
 ip_hash text not null check (char_length(ip_hash)=64),
 email_hash text not null check (char_length(email_hash)=64),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists bm_quote_requests_created_idx on public.bm_quote_requests(created_at desc);
create index if not exists bm_quote_requests_hash_idx on public.bm_quote_requests(email_hash,created_at desc);
create index if not exists bm_quote_requests_ip_idx on public.bm_quote_requests(ip_hash,created_at desc);
alter table public.bm_quote_requests enable row level security;
drop policy if exists bm_quote_requests_admin_read on public.bm_quote_requests;
create policy bm_quote_requests_admin_read on public.bm_quote_requests
 for select to authenticated using ((select private.bm_is_admin()));
drop policy if exists bm_quote_requests_admin_update on public.bm_quote_requests;
create policy bm_quote_requests_admin_update on public.bm_quote_requests
 for update to authenticated using ((select private.bm_is_admin()))
 with check ((select private.bm_is_admin()));
revoke all on public.bm_quote_requests from public,anon,authenticated;
grant select on public.bm_quote_requests to authenticated;
grant update(status,admin_notes,updated_at) on public.bm_quote_requests to authenticated;
-- service_role retains its backend-only privileges, including INSERT.

commit;