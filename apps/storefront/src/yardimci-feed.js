// Yardımcı Bakır / Ticimax: READ-ONLY XML preview (never imports or publishes).
const child=(e,t)=>Array.from(e?.children||[]).find(x=>x.tagName===t)||null;
const children=(e,t)=>Array.from(e?.children||[]).filter(x=>x.tagName===t);
const val=(e,t)=>(child(e,t)?.textContent||'').trim();
const slug=s=>s.toLocaleLowerCase('tr').replace(/ı/g,'i').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s').replace(/ö/g,'o').replace(/ç/g,'c').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,95);
function amount(raw){
 if(!/^\d{1,8}(?:[.,]\d{1,2})?$/.test(raw))throw Error('Fiyat biçimi geçersiz');
 const n=Number(raw.replace(',','.'));
 if(!Number.isFinite(n)||n<=0||n>10000000)throw Error('Fiyat sınır dışı');
 return Math.round(n*100)/100;
}
function photos(e){
 const imageNodes=children(child(e,'Resimler'),'Resim');
 const result=[...new Set(imageNodes.map(n=>(n.textContent||'').trim()).filter(Boolean))];
 if(result.length>8)throw Error('Fotoğraf sayısı 8 sınırını aştı');
 for(const link of result){
  let parsed;try{parsed=new URL(link)}catch{throw Error('Geçersiz fotoğraf bağlantısı')}
  if(parsed.protocol!=='https:'||parsed.hostname!=='static.ticimax.cloud'||parsed.port||parsed.username||parsed.password||link.length>2000)
    throw Error('Görsel bağlantısı doğrulanmadı');
 }
 return result;
}
function category(tree,name){
 const t=tree.toLocaleLowerCase('tr'),n=name.toLocaleLowerCase('tr');
 if(/cezve|sütlük/.test(t)||/cezve/.test(n))return ['cezve','cezve'];
 if(/çaydanlık|demlik/.test(t)||/çaydanlık|demlik/.test(n))return ['caydanlik','caydanlik'];
 if(/tencere|tava|kavurma sacı/.test(t)||/tencere|tava|sahan/.test(n))return ['tencere','tencere'];
 if(/dekorasyon/.test(t)||/vazo|tütsü/.test(n))return ['sofra','dekor'];
 if(/servis|sunum/.test(t))return ['sofra','sunum'];
 return ['sofra','sofra'];
}
export function isYardimciFeed(doc){
 const root=doc?.documentElement;
 return root?.tagName==='Root'&&children(child(root,'Urunler'),'Urun').some(c=>!!child(c,'UrunSecenek'));
}
export function parseYardimciFeed(doc){
 if(!isYardimciFeed(doc))throw Error('Yardımcı Bakır XML şeması bulunamadı');
 const cards=children(child(doc.documentElement,'Urunler'),'Urun');
 if(cards.length>5000)throw Error('XML 5000 ana ürün sınırını aşıyor');
 const pairs=cards.flatMap(c=>children(child(c,'UrunSecenek'),'Secenek').map(o=>({c,o})));
 if(pairs.length>5000)throw Error('XML 5000 varyasyon sınırını aşıyor');
 const active=pairs.filter(({c,o})=>val(c,'Aktif')==='Evet'&&val(o,'Aktif')==='Evet');
 const codeCounts=new Map();
 for(const {o} of active){
  const sku=val(o,'StokKodu').toUpperCase();
  codeCounts.set(sku,(codeCounts.get(sku)||0)+1);
 }
 const duplicated=new Set([...codeCounts].filter(([,count])=>count>1).map(([sku])=>sku));
 const rows=[],errors=[];let hugeStock=0,zeroCost=0;
 for(let i=0;i<pairs.length;i++){
  const {c,o}=pairs[i],sku=val(o,'StokKodu').toUpperCase();
  if(val(c,'Aktif')!=='Evet'||val(o,'Aktif')!=='Evet')continue;
  try{
   if(!/^[A-Z0-9][A-Z0-9_-]{1,119}$/.test(sku))throw Error('Geçersiz varyasyon SKU');
   if(duplicated.has(sku))throw Error('Birden fazla varyasyonda aynı stok kodu: '+sku);
   const name=val(c,'UrunAdi').slice(0,250);
   if(name.length<2||val(c,'UrunAdi').length>250)throw Error('Ürün adı geçersiz');
   const cardId=val(c,'UrunKartiID'),variantId=val(o,'VaryasyonID');
   if(!/^\d+$/.test(cardId)||!/^\d+$/.test(variantId))throw Error('Kimlik eksik');
   const price=amount(val(o,'SatisFiyati')),stockRaw=val(o,'StokAdedi');
   if(!/^\d{1,7}$/.test(stockRaw)||Number(stockRaw)>1000000)throw Error('Geçersiz stok');
   if(val(o,'ParaBirimiKodu')!=='TRY')throw Error('Para birimi TRY değil');
   const vatString=val(o,'KDVDahil').toLowerCase(),vatRate=Number(val(o,'KdvOrani'));
   if(!['true','false'].includes(vatString)||!Number.isInteger(vatRate)||vatRate<0||vatRate>100)throw Error('KDV bilgisi eksik/geçersiz');
   const photoUrls=photos(o).length?photos(o):photos(c);
   const attributes={};
   for(const attr of children(child(o,'EkSecenekOzellik'),'Ozellik')){
    const k=(attr.getAttribute('Tanim')||'').trim(),v=(attr.getAttribute('Deger')||attr.textContent||'').trim();
    if(k&&v)attributes[k]=v;
   }
   const categoryPath=val(c,'KategoriTree')||val(c,'Kategori'),[storeCategory,hydraCategory]=category(categoryPath,name);
   const stock=Number(stockRaw),warnings=[];
   if(stock>=10000){hugeStock++;warnings.push('Stok miktarı teyit edilmeli');}
   if(!photoUrls.length)warnings.push('Varyasyona veya ana ürüne ait görsel yok');
   if(vatString==='false')warnings.push('Fiyat KDV hariç');
   if(Number(val(o,'AlisFiyati'))===0){zeroCost++;warnings.push('Alış fiyatı sıfır');}
   const origin=val(c,'UrunUrl');
   if(!/^https:\/\/yardimcibakir\.com\.tr\//i.test(origin))warnings.push('Kaynak URL inceleme gerektiriyor');
   rows.push({sku,name,price,stock,slug:slug(name)+'-'+slug(sku),category:storeCategory,
    product_type:storeCategory,description:val(c,'Aciklama').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').slice(0,4000),
    image_urls:photoUrls,source_url:origin,source_brand:val(c,'Marka'),
    supplier_category:categoryPath,suggested_hydra_category:hydraCategory,
    product_card_id:cardId,variation_id:variantId,variation_attributes:attributes,
    barcode:val(o,'Barkod'),vat_included:vatString==='true',vat_rate:vatRate,currency:'TRY',
    price_verified:false,stock_verified:false,warnings});
  }catch(error){errors.push({line:i+1,sku,product:val(c,'UrunAdi'),reason:error.message});}
 }
 return {source:'yardimcibakir',sourceBrand:'Yardımcı Bakır',rows,errors,total:pairs.length,
  valid:rows.length,invalid:errors.length,imagesMissing:rows.filter(r=>!r.image_urls.length).length,
  totalCards:cards.length,activeCards:cards.filter(c=>val(c,'Aktif')==='Evet').length,
  activeVariants:active.length,skippedInactive:pairs.length-active.length,
  duplicateSkuCount:active.filter(x=>duplicated.has(val(x.o,'StokKodu').toUpperCase())).length,
  duplicateCodes:[...duplicated],suspiciousStockCount:hugeStock,unpricedCostCount:zeroCost,
  vatExclusiveCount:rows.filter(r=>!r.vat_included).length,
  storefrontReady:false};
}
