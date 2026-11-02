// Shared, pure validation. The database RLS and constraints remain authoritative.
const CATEGORY = new Set(['cezve','caydanlik','tencere','sofra']);
const TYPE = new Set(['cezve','caydanlik','tencere','tepsi','sahan','fincan','set','surahi']);
export function productSlug(text) {
  return String(text || '').toLocaleLowerCase('tr')
    .replace(/[ğüşıöç]/g, c => ({'ğ':'g','ü':'u','ş':'s','ı':'i','ö':'o','ç':'c'}[c]))
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 95);
}
export function validateImages(text) {
  const list = String(text || '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  if(list.length>8) throw new Error('En fazla 8 fotoğraf bağlantısı ekleyebilirsin.');
  const out=[];
  for(const image of list) {
    let u;
    try { u=new URL(image); } catch { throw new Error('Fotoğraf adresi geçersiz: '+image.slice(0,60)); }
    if(u.protocol!=='https:' || u.username || u.password || u.port
      || !u.hostname.includes('.') || u.hostname==='localhost'
      || /^(?:127\.|10\.|192\.168\.)/.test(u.hostname)
      || image.length>2000) {
      throw new Error('Yalnızca güvenilir HTTPS fotoğraf bağlantıları kullanılabilir.');
    }
    if(!out.includes(u.href))out.push(u.href);
  }
  return out;
}
export function validateProduct(values) {
  const sku=String(values.sku||'').trim();
  const name=String(values.name||'').trim();
  const category=String(values.category||'');
  const product_type=String(values.product_type||'');
  const price=Number(values.price),stock=Number(values.stock);
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$/.test(sku))throw new Error('Ürün kodu (SKU) geçersiz.');
  if(name.length<2||name.length>250)throw new Error('Ürün adı 2–250 karakter olmalı.');
  if(!CATEGORY.has(category)||!TYPE.has(product_type))throw new Error('Kategori veya ürün türü geçersiz.');
  if(!Number.isFinite(price)||price<=0||price>=100000000||Math.abs(price*100-Math.round(price*100))>1e-7)throw new Error('Fiyat 0 üstünde ve en fazla 2 ondalık haneli olmalı.');
  if(!Number.isSafeInteger(stock)||stock<0||stock>1000000)throw new Error('Stok 0–1.000.000 arasında bir tam sayı olmalı.');
  const description=String(values.description||'').trim();
  if(description.length>10000)throw new Error('Açıklama en fazla 10.000 karakter olabilir.');
  const image_urls=validateImages(values.images||'');
  const output={sku,name,category,product_type,price,stock,description,image_urls};
  for(const field of ['subtitle','material','size_label','badge']) {
    const val=String(values[field]||'').trim();
    if(val.length>250)throw new Error(field+' alanı çok uzun.');
    output[field]=val;
  }
  output.handmade=!!values.handmade;
  output.tinned=!!values.tinned;
  return output;
}
