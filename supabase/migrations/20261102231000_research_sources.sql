begin;
create table if not exists public.bm_research_sources (
 id uuid primary key default gen_random_uuid(),
 source_name text not null check (char_length(source_name) between 2 and 120),
 source_url text not null unique check (source_url ~ '^https://[a-zA-Z0-9.-]+(/[^[:space:]]*)?$' and char_length(source_url) <= 2048),
 source_host text not null check (char_length(source_host) between 4 and 253),
 category text not null default 'genel' check (category in ('genel','cezve','caydanlik','tencere','sofra')),
 rights_status text not null default 'permission_needed'
    check (rights_status in ('permission_needed','approved','rejected')),
 notes text not null default '',
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bm_research_sources enable row level security;
drop policy if exists "bm_research_admin_select" on public.bm_research_sources;
create policy "bm_research_admin_select" on public.bm_research_sources for select to authenticated using ((select private.bm_is_admin()));
drop policy if exists "bm_research_admin_insert" on public.bm_research_sources;
create policy "bm_research_admin_insert" on public.bm_research_sources for insert to authenticated with check ((select private.bm_is_admin()));
drop policy if exists "bm_research_admin_update" on public.bm_research_sources;
create policy "bm_research_admin_update" on public.bm_research_sources for update to authenticated using ((select private.bm_is_admin())) with check ((select private.bm_is_admin()));
revoke all on public.bm_research_sources from anon,authenticated;
grant select,insert,update on public.bm_research_sources to authenticated;
insert into public.bm_research_sources(source_name,source_url,source_host,category,notes)
values
 ('Toptan Bakır — üretici adayı','https://toptanbakir.com/','toptanbakir.com','genel','Toptan / bayi katalog izni, ürün görselleri, stok ve fiyat akışı şartları henüz teyit edilmedi.'),
 ('Turkish Copperware — B2B adayı','https://turkishcopperware.com/tr','turkishcopperware.com','genel','Ürün XML/API erişimi ve satış/yeniden görsel kullanımı izni talep edilmeli.'),
 ('BakırBul — ürün kaynağı adayı','https://bakirbul.com/','bakirbul.com','genel','Katalog erişimi, ticari yeniden kullanım ve canlı stok yetkisi teyit edilmeli.'),
 ('The Coppery — üretici rehberi','https://thecoppery.com/tr','thecoppery.com','genel','B2B üretici rehberi; doğrudan XML akışı doğrulanmış değil.')
on conflict (source_url) do nothing;
commit;