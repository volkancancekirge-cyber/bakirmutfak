// Supabase REST client without a browser SDK; the anon key is public, RLS does all authorization.
const rawUrl = import.meta.env.VITE_SUPABASE_URL || '';
const rawKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(rawUrl) && rawKey.length > 20 && !rawKey.startsWith('YOUR_');
const url = rawUrl.replace(/\/+$/, '');
const sessionKey = 'bakirmutfak.admin.session';

function loadSession() {
  try { return JSON.parse(sessionStorage.getItem(sessionKey) || 'null'); } catch { return null; }
}
let session = loadSession();
export function currentSession() { return session; }
export function logout() { session = null; sessionStorage.removeItem(sessionKey); }
function saveSession(value) {
  session = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: Math.floor(Date.now()/1000) + Number(value.expires_in || 3600) };
  sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

async function fetchApi(path, options = {}, authorized = false) {
  if (!configured) throw new Error('Supabase bağlantı ayarları henüz girilmedi.');
  if (authorized && !session?.access_token) throw new Error('Yönetici oturumu gerekli.');
  if (authorized && session.expires_at - 60 < Date.now()/1000) await refresh();
  const token = authorized ? session.access_token : (rawKey.split('.').length === 3 ? rawKey : null);
  const response = await fetch(url + path, {
    ...options,
    cache: 'no-store',
    headers: { apikey: rawKey, ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.body ? {'Content-Type':'application/json'} : {}), ...(options.headers || {}) }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    if (response.status === 401 && authorized) logout();
    throw new Error(body.message || body.error_description || body.error || 'Sunucu isteği başarısız (' + response.status + ').');
  }
  if (response.status === 204) return null;
  return response.json();
}

async function refresh() {
  if (!session?.refresh_token) throw new Error('Oturum süresi doldu.');
  const res = await fetch(url + '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST', headers: { apikey: rawKey, 'Content-Type':'application/json' },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });
  if (!res.ok) { logout(); throw new Error('Oturum sona erdi. Yeniden giriş yapın.'); }
  saveSession(await res.json());
}

export async function login(email, password) {
  const res = await fetch(url + '/auth/v1/token?grant_type=password', {
    method:'POST', headers:{ apikey:rawKey,'Content-Type':'application/json' },
    body:JSON.stringify({email,password})
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('E-posta veya şifre hatalı ya da hesap etkin değil.');
  saveSession(data);
  const admin = await getAdmin();
  if (!admin) { logout(); throw new Error('Bu hesabın Bakır Mutfak yönetici yetkisi bulunmuyor.'); }
  return admin;
}

export async function getAdmin() {
  if (!session) return null;
  const user = await fetchApi('/auth/v1/user', {}, true);
  const id = String(user.id || '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Yönetici kimliği doğrulanamadı.');
  const rows = await fetchApi('/rest/v1/bm_admin_users?select=role,user_id&user_id=eq.' + encodeURIComponent(id), {}, true);
  return rows?.[0] ? { id, role: rows[0].role, email: user.email } : null;
}

export async function publishedProducts() {
  return fetchApi('/rest/v1/bm_products?select=*&published=eq.true&order=created_at.desc&limit=500');
}

export async function adminProducts() {
  return fetchApi('/rest/v1/bm_products?select=*&order=created_at.desc&limit=500', {}, true);
}

export async function setPublished(id, value) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Geçersiz ürün kimliği');
  const saved=await fetchApi('/rest/v1/bm_products?id=eq.' + id, {
    method:'PATCH',
    headers:{ Prefer:'return=representation' },
    body:JSON.stringify({published:!!value})
  }, true);
  if(!Array.isArray(saved)||saved.length!==1||saved[0].id!==id||saved[0].published!==!!value)
    throw new Error('Ürün yayın durumu sunucuda doğrulanamadı.');
  return saved[0];
}

export async function saveProduct(row) {
  const saved=await fetchApi('/rest/v1/bm_products', {
    method:'POST', headers:{ Prefer:'return=representation' },
    body:JSON.stringify([row])
  }, true);
  if(!Array.isArray(saved)||saved.length!==1||!saved[0].id)
    throw new Error('Yeni ürün veritabanına kaydedilmedi.');
  return saved[0];
}

export async function updateProduct(id, row) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Geçersiz ürün kimliği.');
  const changed=await fetchApi('/rest/v1/bm_products?id=eq.' + id, {
    method:'PATCH', headers:{ Prefer:'return=representation' },
    body:JSON.stringify(row)
  }, true);
  if(!Array.isArray(changed)||changed.length!==1||changed[0].id!==id)throw new Error('Ürün kaydedilemedi veya güncelleme yetkisi bulunamadı.');
  return changed[0];
}

export async function uploadProductImage(file, sku) {
  if (!configured) throw new Error('Supabase bağlantısı yapılandırılmadı.');
  if (!session?.access_token) throw new Error('Yönetici oturumu gerekli.');
  if (session.expires_at - 60 < Date.now()/1000) await refresh();
  if (!(await getAdmin())) throw new Error('Yönetici yetkisi gerekli.');
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$/.test(sku)) throw new Error('Geçersiz SKU.');
  const mime = {'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  const ext = mime[file.type];
  if (!ext || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error('Yalnızca JPEG, PNG veya WebP ve en fazla 5 MB fotoğraf yüklenebilir.');
  }
  const key = 'products/' + sku + '/' + crypto.randomUUID() + '.' + ext;
  const response = await fetch(url + '/storage/v1/object/bm-product-images/' + key, {
    method: 'POST',
    headers: {
      apikey: rawKey,
      Authorization: 'Bearer ' + session.access_token,
      'Content-Type': file.type,
      'cache-control': '3600',
      'x-upsert': 'false'
    },
    body: file
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.message || detail.error || 'Fotoğraf yüklenemedi.');
  }
  return url + '/storage/v1/object/public/bm-product-images/' + key;
}

export async function applyXmlImport(filename, rows, allowLargePriceChanges) {
  return fetchApi('/rest/v1/rpc/bm_apply_xml_import', {
    method:'POST',
    body:JSON.stringify({p_source:filename.slice(0,120),p_rows:rows,p_allow_large_price_changes:!!allowLargePriceChanges})
  }, true);
}

export async function productAudit() {
  return fetchApi('/rest/v1/bm_product_audit?select=id,sku,action,before_state,after_state,created_at&order=created_at.desc&limit=80', {}, true);
}


export async function researchSources() {
  return fetchApi('/rest/v1/bm_research_sources?select=id,source_name,source_url,source_host,category,rights_status,notes,created_at&order=created_at.desc&limit=80',{},true);
}
export async function addResearchSource(source_name,source_url,category='genel') {
  const name=String(source_name||'').trim();
  const input=String(source_url||'').trim();
  if(name.length<2||name.length>120)throw new Error('Kaynak adı 2–120 karakter olmalı.');
  let u;try{u=new URL(input)}catch{throw new Error('Kaynak adresi geçersiz.');}
  if(u.protocol!=='https:'||u.username||u.password||u.port||u.hash||!u.hostname.includes('.')
     ||/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(u.hostname)||input.length>2048)
    throw new Error('Yalnızca herkese açık HTTPS tedarikçi adresleri eklenebilir.');
  if(!['genel','cezve','caydanlik','tencere','sofra'].includes(category))throw new Error('Kategori geçersiz.');
  return fetchApi('/rest/v1/bm_research_sources',{
    method:'POST',headers:{Prefer:'return=representation'},
    body:JSON.stringify([{source_name:name,source_url:u.href,source_host:u.hostname,category,rights_status:'permission_needed'}])
  },true);
}
export async function setResearchPermission(id,status) {
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Kaynak kimliği geçersiz.');
  if(!['permission_needed','approved','rejected'].includes(status))throw new Error('İzin durumu geçersiz.');
  return fetchApi('/rest/v1/bm_research_sources?id=eq.'+id,{
    method:'PATCH',headers:{Prefer:'return=representation'},
    body:JSON.stringify({rights_status:status,updated_at:new Date().toISOString()})
  },true);
}


// Authenticated supplier-image review gallery. Never writes to bm_products.
export async function imageCandidates() {
  return fetchApi('/rest/v1/bm_product_candidates?select=id,source_url,source_host,supplier_sku,name,image_urls,review_status,created_at&order=created_at.desc&limit=60',{},true);
}
export async function previewApprovedPhotos(sourceUrl) {
  return fetchApi('/functions/v1/approved-photo-import',{
    method:'POST',
    body:JSON.stringify({mode:'preview',source_url:sourceUrl})
  },true);
}
export async function importApprovedPhotos(sourceUrl,images) {
  return fetchApi('/functions/v1/approved-photo-import',{
    method:'POST',
    body:JSON.stringify({mode:'import',source_url:sourceUrl,selected_urls:images})
  },true);
}
export async function setImageCandidateReview(id,status) {
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Görsel adayı kimliği geçersiz.');
  if(!['needs_review','accepted','rejected'].includes(status))throw new Error('Geçersiz inceleme durumu.');
  return fetchApi('/rest/v1/bm_product_candidates?id=eq.'+id,{
    method:'PATCH',headers:{Prefer:'return=representation'},
    body:JSON.stringify({review_status:status,updated_at:new Date().toISOString()})
  },true);
}

// Read-only storefront catalog, without sales price or checkout.
export async function publicSourceCatalog() {
  return fetchApi('/rest/v1/bm_source_catalog?select=id,source_url,source_host,supplier_sku,name,category,image_urls&visibility=eq.visible&order=created_at.desc&limit=1000');
}
export async function bulkCatalogAction(payload) {
  return fetchApi('/functions/v1/approved-catalog-bulk',{
    method:'POST',body:JSON.stringify(payload)
  },true);
}
export async function bulkQueueStatus(){
  return fetchApi('/rest/v1/bm_catalog_queue?select=source_host,status&order=created_at.asc&limit=5000',{},true);
}


// Hydra public merchandising. Category overrides never modify supplier feed data.
export async function hydraSettings(){
 const rows=await fetchApi('/rest/v1/bm_hydra_settings?select=id,hero_title,hero_subtitle,hero_category,featured_categories&id=eq.1');
 return rows?.[0]||null;
}
export async function hydraMerchandising(){
 return fetchApi('/rest/v1/bm_hydra_merchandising?select=product_id,display_category,featured,sort_priority,hidden_from_storefront&limit=5000');
}
export async function saveHydraSettings(values){
 const title=String(values.hero_title||'').trim();
 const subtitle=String(values.hero_subtitle||'').trim();
 const available=new Set(['cezve','caydanlik','tencere','sunum','dekor','sofra']);
 const categories=values.featured_categories;
 if(title.length<8||title.length>90)throw new Error('Vitrin başlığı 8–90 karakter olmalı.');
 if(subtitle.length<12||subtitle.length>350)throw new Error('Vitrin açıklaması 12–350 karakter olmalı.');
 if(!['all',...available].includes(values.hero_category))throw new Error('Hero kategorisi geçersiz.');
 if(!Array.isArray(categories)||categories.length<1||categories.length>6||
    new Set(categories).size!==categories.length||categories.some(c=>!available.has(c)))
   throw new Error('Vitrin kategorilerini kontrol et.');
 const saved=await fetchApi('/rest/v1/bm_hydra_settings?id=eq.1',{
  method:'PATCH',headers:{Prefer:'return=representation'},
  body:JSON.stringify({hero_title:title,hero_subtitle:subtitle,
   hero_category:values.hero_category,featured_categories:categories,updated_at:new Date().toISOString()})
 },true);
 if(!Array.isArray(saved)||saved.length!==1||saved[0].id!==1||
    saved[0].hero_title!==title||saved[0].hero_subtitle!==subtitle||
    saved[0].hero_category!==values.hero_category||
    JSON.stringify(saved[0].featured_categories)!==JSON.stringify(categories))
   throw new Error('Sunucu değişikliği doğrulamadı. Kaydedilmemiş olabilir.');
 const reread=await hydraSettings();
 if(!reread||reread.hero_title!==title||reread.hero_subtitle!==subtitle||
    JSON.stringify(reread.featured_categories)!==JSON.stringify(categories)||
    reread.hero_category!==values.hero_category)
   throw new Error('Kaydetme yanıtı alındı fakat veritabanındaki kayıt eşleşmiyor. Lütfen tekrar dene.');
 return reread;
}
export async function adminSourceCatalog(){
 return fetchApi('/rest/v1/bm_source_catalog?select=id,name,category,source_host,source_url,supplier_sku,image_urls,visibility&order=created_at.desc&limit=5000',{},true);
}
export async function saveHydraMerchandising(product_id,values){
 if(!/^[0-9a-f-]{36}$/i.test(product_id))throw new Error('Ürün kimliği geçersiz.');
 if(values.display_category!==null&&!['cezve','caydanlik','tencere','sunum','dekor','sofra'].includes(values.display_category))
    throw new Error('Kategori geçersiz.');
 if(!Number.isInteger(values.sort_priority)||Math.abs(values.sort_priority)>1000)
    throw new Error('Öncelik -1000 ile 1000 arasında olmalı.');
 const update={display_category:values.display_category,featured:!!values.featured,
   sort_priority:values.sort_priority,hidden_from_storefront:!!values.hidden_from_storefront};
 const saved=await fetchApi('/rest/v1/bm_hydra_merchandising?on_conflict=product_id',{
  method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},
  body:JSON.stringify([{product_id,...update,updated_at:new Date().toISOString()}])
 },true);
 if(!Array.isArray(saved)||saved.length!==1||saved[0].product_id!==product_id)
   throw new Error('Vitrin değişikliği sunucu tarafından kaydedilmedi.');
 const reread=await fetchApi('/rest/v1/bm_hydra_merchandising?select=product_id,display_category,featured,sort_priority,hidden_from_storefront&product_id=eq.'+product_id,{},true);
 const row=reread?.[0];
 if(!row||Object.entries(update).some(([key,value])=>row[key]!==value))
   throw new Error('Kaydetme doğrulaması başarısız. Kayıt güncel değil.');
 return row;
}
export async function adminQuoteRequests(){
 return fetchApi('/rest/v1/bm_quote_requests?select=id,contact_name,contact_email,contact_phone,message,items,status,admin_notes,created_at&order=created_at.desc&limit=100',{},true);
}
export async function updateQuoteRequest(id,status,admin_notes){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('Geçersiz teklif kimliği.');
 if(!['new','reviewing','answered','closed'].includes(status))throw new Error('Geçersiz talep durumu.');
 const notes=String(admin_notes||'').slice(0,3000);
 const saved=await fetchApi('/rest/v1/bm_quote_requests?id=eq.'+id,{
  method:'PATCH',headers:{Prefer:'return=representation'},
  body:JSON.stringify({status,admin_notes:notes,updated_at:new Date().toISOString()})
 },true);
 if(!Array.isArray(saved)||saved.length!==1||saved[0].id!==id||
    saved[0].status!==status||saved[0].admin_notes!==notes)
    throw new Error('Talep güncellemesi sunucuda doğrulanamadı.');
 return saved[0];
}
export async function submitQuoteRequest(data){
 return fetchApi('/functions/v1/hydra-quote-request',{
  method:'POST',body:JSON.stringify(data)
 });
}


// Verified public catalog copy; anonymous visitors never receive draft text.
export async function publicCatalogContent(){
 return fetchApi('/rest/v1/bm_product_content?select=product_id,short_description,description,specifications,source_kind,review_status&review_status=eq.approved&limit=5000');
}
export async function adminCatalogContent(){
 return fetchApi('/rest/v1/bm_product_content?select=product_id,short_description,description,specifications,source_kind,review_status,updated_at&limit=5000',{},true);
}
export async function saveCatalogContent(product_id,input){
 if(!/^[0-9a-f-]{36}$/i.test(product_id))throw new Error('Ürün kimliği geçersiz.');
 const description=String(input.description||'').trim();
 const short_description=String(input.short_description||'').trim();
 const status=input.review_status;
 const kind=input.source_kind;
 const specifications=input.specifications||{};
 if(!['draft','approved'].includes(status))throw new Error('İçerik durumu geçersiz.');
 if(!['supplier_page','supplier_document','manual_review'].includes(kind))throw new Error('Kaynak tipi geçersiz.');
 if(description.length>6000||short_description.length>700||status==='approved'&&description.length<80)
    throw new Error('Onaylı açıklama en az 80, en fazla 6000 karakter olmalı.');
 if(!specifications||typeof specifications!=='object'||Array.isArray(specifications)||Object.keys(specifications).length>18)
    throw new Error('Teknik özellikler en fazla 18 satır olabilir.');
 const data={product_id,short_description,description,specifications,source_kind:kind,review_status:status,updated_at:new Date().toISOString()};
 const saved=await fetchApi('/rest/v1/bm_product_content?on_conflict=product_id',{
  method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([data])
 },true);
 if(!Array.isArray(saved)||saved.length!==1||saved[0].product_id!==product_id)
   throw new Error('Ürün açıklaması veritabanına kaydedilmedi.');
 const rows=await fetchApi('/rest/v1/bm_product_content?select=product_id,short_description,description,specifications,source_kind,review_status&product_id=eq.'+product_id,{},true);
 const row=rows?.[0];
 if(!row||row.description!==description||row.short_description!==short_description||row.review_status!==status||
    row.source_kind!==kind||JSON.stringify(row.specifications)!==JSON.stringify(specifications))
    throw new Error('Ürün açıklaması kaydedilmiş görünse de yeniden okuma doğrulaması başarısız.');
 return row;
}


export async function previewSupplierContent(product_id){
 if(!/^[0-9a-f-]{36}$/i.test(product_id))throw new Error('Kaynak ürün kimliği geçersiz.');
 const result=await fetchApi('/functions/v1/supplier-content-preview',{
  method:'POST',body:JSON.stringify({product_id})
 },true);
 if(!result?.ok||result.requires_review!==true||typeof result.description!=='string')
   throw new Error('Tedarikçi metni incelenemedi.');
 return result;
}
