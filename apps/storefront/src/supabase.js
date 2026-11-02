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
  return fetchApi('/rest/v1/bm_products?id=eq.' + id, {
    method:'PATCH',
    headers:{ Prefer:'return=representation' },
    body:JSON.stringify({published:!!value})
  }, true);
}

export async function saveProduct(row) {
  return fetchApi('/rest/v1/bm_products', {
    method:'POST', headers:{ Prefer:'return=representation' },
    body:JSON.stringify([row])
  }, true);
}

export async function updateProduct(id, row) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Geçersiz ürün kimliği.');
  return fetchApi('/rest/v1/bm_products?id=eq.' + id, {
    method:'PATCH', headers:{ Prefer:'return=representation' },
    body:JSON.stringify(row)
  }, true);
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
