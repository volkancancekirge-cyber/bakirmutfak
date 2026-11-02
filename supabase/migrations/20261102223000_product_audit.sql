-- Auditable product edits. Authenticated users may read log only if admin; cannot insert/edit audit events.
begin;

create table if not exists public.bm_product_audit (
  id bigint generated always as identity primary key,
  product_id uuid references public.bm_products(id) on delete set null,
  sku text not null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('created','updated','deleted')),
  before_state jsonb,
  after_state jsonb,
  created_at timestamptz not null default now()
);

alter table public.bm_product_audit enable row level security;
drop policy if exists "bm_product_audit_admin_read" on public.bm_product_audit;
create policy "bm_product_audit_admin_read" on public.bm_product_audit
  for select to authenticated
  using ((select private.bm_is_admin()));
revoke all on public.bm_product_audit from anon, authenticated;
grant select on public.bm_product_audit to authenticated;
create index if not exists bm_product_audit_recent on public.bm_product_audit(created_at desc);

create or replace function private.bm_log_product_change()
returns trigger language plpgsql security definer set search_path = '' as $body$
declare
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op <> 'INSERT' then
    v_old := jsonb_build_object(
      'name', old.name, 'price', old.price, 'stock', old.stock,
      'published', old.published, 'images', cardinality(old.image_urls)
    );
  end if;
  if tg_op <> 'DELETE' then
    v_new := jsonb_build_object(
      'name', new.name, 'price', new.price, 'stock', new.stock,
      'published', new.published, 'images', cardinality(new.image_urls)
    );
  end if;
  if tg_op = 'UPDATE' and v_old = v_new then
    return new;
  end if;
  insert into public.bm_product_audit(product_id,sku,actor_id,action,before_state,after_state)
  values(
    case when tg_op='DELETE' then old.id else new.id end,
    case when tg_op='DELETE' then old.sku else new.sku end,
    (select auth.uid()),
    case tg_op when 'INSERT' then 'created' when 'DELETE' then 'deleted' else 'updated' end,
    v_old,v_new
  );
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$body$;
revoke all on function private.bm_log_product_change() from public, anon, authenticated;
drop trigger if exists bm_products_audit_change on public.bm_products;
create trigger bm_products_audit_change
  after insert or update or delete on public.bm_products
  for each row execute function private.bm_log_product_change();

commit;
