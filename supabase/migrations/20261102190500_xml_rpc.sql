-- One atomic server-side XML batch commit; requires an authenticated admin.
-- PostgREST RPC: POST /rest/v1/rpc/bm_apply_xml_import
create or replace function public.bm_apply_xml_import(
  p_source text,
  p_rows jsonb,
  p_allow_large_price_changes boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_item jsonb;
  v_sku text;
  v_name text;
  v_slug text;
  v_category text;
  v_type text;
  v_description text;
  v_price numeric(12,2);
  v_stock integer;
  v_images text[];
  v_existing_price numeric(12,2);
  v_inserted integer := 0;
  v_updated integer := 0;
  v_seen text[] := '{}';
begin
  if not public.bm_is_admin() then
    raise exception 'Bu işlem için yönetici yetkisi gerekli.' using errcode = '42501';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array'
     or jsonb_array_length(p_rows) = 0 or jsonb_array_length(p_rows) > 500 then
    raise exception '1 ile 500 ürün arasındaki XML aktarımı desteklenir.';
  end if;

  if p_source is null or length(p_source) not between 1 and 120 then
    raise exception 'Geçerli tedarikçi dosya adı gerekli.';
  end if;

  for v_item in select value from jsonb_array_elements(p_rows)
  loop
    v_sku := v_item->>'sku';
    v_name := v_item->>'name';
    v_slug := v_item->>'slug';
    v_category := v_item->>'category';
    v_type := v_item->>'product_type';
    v_description := coalesce(v_item->>'description','');

    if coalesce(v_sku,'') !~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$'
       or v_sku = any(v_seen) then
      raise exception 'Eksik, uygunsuz veya tekrar eden SKU: %', v_sku;
    end if;
    v_seen := array_append(v_seen, v_sku);

    if length(coalesce(v_name,'')) not between 2 and 250
       or coalesce(v_slug,'') !~ '^[a-z0-9-]{3,180}$' then
      raise exception 'Geçersiz ürün adı veya SEO adresi: %', v_sku;
    end if;
    if v_category not in ('cezve','caydanlik','tencere','sofra')
       or v_type not in ('cezve','caydanlik','tencere','tepsi','sahan','fincan','set','surahi') then
      raise exception 'Geçersiz kategori/tür: %', v_sku;
    end if;

    if coalesce(v_item->>'price','') !~ '^[0-9]{1,8}(\.[0-9]{1,2})?$'
       or coalesce(v_item->>'stock','') !~ '^[0-9]{1,7}$' then
      raise exception 'Geçersiz fiyat/stok: %', v_sku;
    end if;
    v_price := (v_item->>'price')::numeric(12,2);
    v_stock := (v_item->>'stock')::integer;

    if v_price <= 0 or v_stock > 1000000 then
      raise exception 'Fiyat/stok sınırı aşıldı: %', v_sku;
    end if;

    if jsonb_typeof(v_item->'image_urls') = 'array' then
      if jsonb_array_length(v_item->'image_urls') > 8 then
        raise exception 'Bir ürün için en fazla 8 görsel desteklenir: %', v_sku;
      end if;
      select coalesce(array_agg(url), '{}') into v_images
      from jsonb_array_elements_text(v_item->'image_urls') as url;
      if exists(select 1 from unnest(v_images) as x where x !~ '^https://[^/\s]+/' or length(x) > 2000) then
        raise exception 'Görsel bağlantısı uygun değil: %', v_sku;
      end if;
    else
      v_images := '{}';
    end if;

    select price into v_existing_price from public.bm_products where sku = v_sku for update;

    if found then
      if not p_allow_large_price_changes
         and abs(v_existing_price - v_price) > v_existing_price * 0.30 then
        raise exception '%%30 üstü fiyat değişikliği için ayrıca onay gerekli: %', v_sku;
      end if;

      update public.bm_products set
        name = v_name,
        category = v_category,
        product_type = v_type,
        description = v_description,
        price = v_price,
        stock = v_stock,
        image_urls = case when cardinality(v_images) > 0 then v_images else image_urls end
      where sku = v_sku;
      -- Keep slug, manual published state and product enrichments on existing items.
      v_updated := v_updated + 1;
    else
      insert into public.bm_products(
        sku,slug,name,category,product_type,description,price,stock,image_urls,published
      ) values (
        v_sku,v_slug,v_name,v_category,v_type,v_description,v_price,v_stock,v_images,false
      );
      v_inserted := v_inserted + 1;
    end if;
  end loop;

  insert into public.bm_import_audit(admin_id,source_name,row_count,inserted_count,updated_count)
  values ((select auth.uid()),p_source,jsonb_array_length(p_rows),v_inserted,v_updated);

  return jsonb_build_object('inserted',v_inserted,'updated',v_updated,'total',v_inserted+v_updated);
end;
$$;

revoke all on function public.bm_apply_xml_import(text,jsonb,boolean) from public;
grant execute on function public.bm_apply_xml_import(text,jsonb,boolean) to authenticated;
