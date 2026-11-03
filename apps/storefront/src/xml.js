import { isYardimciFeed, parseYardimciFeed } from './yardimci-feed.js';
// Strict browser-side preview; NO remote XML fetch and NO database write.
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const first=(element,names)=>{for(const name of names){const nodes=element.getElementsByTagName(name);if(nodes.length){const txt=nodes[0]?.textContent?.trim();if(txt)return txt}const attr=element.getAttribute(name);if(attr)return attr.trim()}return ''};
const fields={
  sku:['StokKodu','stok_kodu','Sku','SKU','Kod','sku'],
  name:['UrunAdi','Urun_Adi','UrunAd','Ad','Name','Urun','product_name'],
  price:['SatisFiyati','Fiyat','price','Price','Satis_Fiyat'],
  stock:['StokAdedi','Stok','stock','Adet','Miktar'],
  description:['Aciklama','Description','description','Detay'],
  images:['Gorsel','Resim','Resim1','Resim2','Resim3','image','Image','ImageUrl','Foto','FotoUrl']
};
function numberPrice(raw){
  let t=raw.replace(/[\s₺]/g,'').replace(/TRY|TL/gi,'');
  if(!/^\d+(?:[,.]\d{1,2})?$/.test(t)&&!/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(t))throw Error('Fiyat biçimi geçersiz: '+raw.slice(0,30));
  if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(t))t=t.replace(/\./g,'');
  const n=Number(t.replace(',','.'));
  if(!Number.isFinite(n)||n<=0||n>10000000)throw Error('Fiyat sınırı aşıldı');
  return Math.round(n*100)/100;
}
function slug(s){return s.toLocaleLowerCase('tr').replace(/[ğ]/g,'g').replace(/[ü]/g,'u').replace(/[ş]/g,'s').replace(/[ı]/g,'i').replace(/[ö]/g,'o').replace(/[ç]/g,'c').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,95)}
function detectCategory(name){const n=name.toLocaleLowerCase('tr');if(/cezve|kahve/.test(n))return ['cezve','cezve'];if(/çaydan|caydan|demlik/.test(n))return ['caydanlik','caydanlik'];if(/tencere|sahan|tava/.test(n))return ['tencere',/sahan/.test(n)?'sahan':'tencere'];if(/tepsi/.test(n))return ['sofra','tepsi'];if(/sürahi|surahi/.test(n))return ['sofra','surahi'];if(/set/.test(n))return ['sofra','set'];return ['sofra','tepsi']}
function imagesFor(node){
  const result=[];
  for(const name of fields.images){
    for(const el of Array.from(node.getElementsByTagName(name))){
      const u=el.textContent.trim();
      if(!u)continue;
      if(!/^https:\/\/[a-z0-9.-]+\/[^\s<>"']+$/i.test(u)||u.length>2000)throw Error('Geçersiz görsel adresi');
      if(!result.includes(u))result.push(u);
    }
  }
  if(result.length>8)throw Error('8 görsel sınırı aşıldı');
  return result;
}
export function parseSupplierXml(text){
  if(text.length>15*1024*1024)throw Error('XML ön izlemesi en fazla 15 MB destekler. Büyük dosyalar için ayrı sunucu ön inceleme gerekli.');
  if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('Güvenlik nedeniyle DTD/ENTITY içeren XML kabul edilmez.');
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw Error('XML biçimi bozuk.');
  if(isYardimciFeed(doc))return parseYardimciFeed(doc);
  const selectors=['Urun','urun','Product','product','item','Item'];
  const tag=selectors.find(n=>doc.getElementsByTagName(n).length);
  if(!tag)throw Error('XML içinde ürün etiketi bulunamadı (Urun/Product/item).');
  const entries=Array.from(doc.getElementsByTagName(tag));
  if(entries.length>5000)throw Error('Güvenli ön izleme en fazla 5000 ürün destekler. Büyük dosyalar için parça bazlı kontrol gerekir.');
  const rows=[],errors=[],seen=new Set();
  for(let i=0;i<entries.length;i++){
    const node=entries[i];
    try{
      const sku=first(node,fields.sku),name=first(node,fields.name),price=numberPrice(first(node,fields.price));
      const stockStr=first(node,fields.stock);
      if(!/^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$/.test(sku))throw Error('Geçersiz SKU');
      if(name.length<2||name.length>250)throw Error('Geçersiz ürün adı');
      if(!/^\d{1,7}$/.test(stockStr)||Number(stockStr)>1000000)throw Error('Geçersiz stok');
      if(seen.has(sku.toLowerCase()))throw Error('Tekrarlanan SKU');
      seen.add(sku.toLowerCase());
      const [category,product_type]=detectCategory(name);
      rows.push({sku,name,price,stock:Number(stockStr),slug:slug(name)+'-'+slug(sku),category,product_type,description:first(node,fields.description).slice(0,4000),image_urls:imagesFor(node)});
    }catch(e){errors.push({line:i+1,reason:e.message});}
  }
  return {rows,errors,total:entries.length,valid:rows.length,invalid:errors.length,imagesMissing:rows.filter(r=>!r.image_urls.length).length};
}
export function csvFromRows(rows){
  const cols=['sku','name','price','stock','category','product_type','description','images'];
  return [cols.join(','),...rows.map(row=>cols.map(k=>{
    const raw=k==='images'?row.image_urls.join('|'):String(row[k]??'');
    // Supplier-provided text may contain spreadsheet formulas. Escape them in CSV exports.
    const safe=/^[\u0000-\u0020]*[=+\-@]/.test(raw)?"'"+raw:raw;
    return '"'+safe.replace(/"/g,'""')+'"';
  }).join(','))].join('\r\n');
}

/** Inspect an unknown XML vendor schema locally, without importing or transmitting it. */
export function inspectSupplierXml(text) {
 if(typeof text!=='string'||text.length>15*1024*1024)
   throw Error('XML ön izleme dosyası 15 MB sınırını aşıyor.');
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('DTD/ENTITY içeren XML kabul edilmez.');
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.getElementsByTagName('parsererror').length)throw Error('XML biçimi bozuk.');
 const root=doc.documentElement;
 if(!root)throw Error('Boş XML dosyası.');
 const names=new Map();
 const values=new Map();
 const elements=Array.from(doc.getElementsByTagName('*'));
 if(elements.length>100000)throw Error('XML çok fazla etiket içeriyor, sunucu tarafında incelenmeli.');
 for(const e of elements){
   const tag=e.localName||e.tagName;
   const children=Array.from(e.children||[]);
   if(children.length){
     const row=names.get(tag)||{name:tag,count:0,fields:new Set()};
     row.count++;
     for(const child of children.slice(0,30))row.fields.add(child.localName||child.tagName);
     for(const attr of Array.from(e.attributes||[]).slice(0,12))row.fields.add('@'+attr.name);
     names.set(tag,row);
   }else{
     values.set(tag,(values.get(tag)||0)+1);
   }
 }
 const rows=Array.from(names.values()).sort((a,b)=>b.count-a.count)
   .filter(x=>x.count>1).slice(0,7).map(x=>({tag:x.name,count:x.count,fields:[...x.fields].slice(0,24)}));
 const likely=rows.find(x=>/^(urun|product|item|row|entry|stock|record)$/i.test(x.tag))||rows[0]||null;
 return {root:root.localName||root.tagName,elementCount:elements.length,rowCandidates:rows,
   likelyRow:likely,fields:likely?.fields||[],leafCount:values.size};
}
