// Provenance-aware product copy: facts are extracted ONLY from the recorded name,
// otherwise shown as buyer guidance. No invented tinning, size, capacity or stock.
const buyerGuidance={
 cezve:'Cezve seçerken fincan sayısına uygun hacmi, iç yüzeyin kullanım amacına uygunluğunu ve sap yapısını kontrol edin.',
 caydanlik:'Çaydanlık ve demlik seçerken kapasiteyi, kapak uyumunu ve iç yüzeyin kullanım amacına uygunluğunu kontrol edin.',
 tencere:'Tencere, sahan veya tava seçerken çap ve derinlik kadar iç kaplama ve ocak uyumluluğunun üretici tarafından doğrulanması da önemlidir.',
 sunum:'Sofra ve sunum ürünlerinde ölçülerin, kullanım amacının ve bakım talimatlarının ürüne özel olarak doğrulanması önerilir.',
 dekor:'Dekoratif modellerde boyut, yüzey işlemi ve bakım koşulları seçim yaparken karşılaştırılabilir.',
 sofra:'Ürünü seçerken ölçü, yüzey işlemi, kullanım ve bakım koşullarına ait tedarikçi bilgilerini kontrol edin.'
};
const normalized=s=>String(s||'').trim().replace(/\s+/g,' ');
function sourceTag(p){return p.source_host==='bakirbul.com'?'BakırBul':p.source_host==='thecoppery.com'?'The Coppery':'Tedarikçi';}
export function titleFacts(product){
 const name=normalized(product?.name);
 const facts=[];
 // Numbers alone must not become capacities. Record only explicit units.
 for(const [label,rx] of [
  ['Ölçü',/\b\d+(?:[.,]\d+)?\s*(?:cm|mm)\b/i],
  ['Kapasite',/\b\d+(?:[.,]\d+)?\s*(?:ml|litre|lt|l)\b/i],
  ['Model numarası',/\b\d+\s*(?:no|numara)\b/i],
  ['Set',/\b\d+['’]lü\s*(?:takım|set)?\b/i]
 ]){
  const m=name.match(rx);if(m)facts.push({label,value:m[0],from:'Ürün başlığı'});
 }
 for(const [label,words] of [
  ['İşçilik',[/el dövme/gi,/makine dövme/gi,/makina dövme/gi,/el işlemeli/gi,/el işleme/gi]],
  ['Yüzey / renk',[/\bnikel\b/gi,/\boksit\b/gi,/\bkırmızı\b/gi,/\bkalaylı\b/gi,/\bçift renk\b/gi,/\beskitme\b/gi]]
 ]){
  const matches=words.flatMap(rx=>Array.from(name.matchAll(rx),m=>m[0]));
  if(matches.length)facts.push({label,value:[...new Set(matches)].join(', '),from:'Ürün başlığı'});
 }
 return facts;
}
export function fallbackProductContent(product,category){
 const name=normalized(product?.name)||'Ürün';
 const sku=normalized(product?.supplier_sku||product?.sku);
 const facts=titleFacts(product);
 const context=buyerGuidance[category]||buyerGuidance.sofra;
 const parts=[
  name+' modelini Bakır Mutfak koleksiyonunda inceleyebilirsiniz.',
  facts.length?'Ürün başlığında '+facts.map(x=>x.label.toLocaleLowerCase('tr')+' olarak '+x.value).join('; ')+' bilgileri yer alıyor.':'Modelin ölçü, yüzey ve diğer teknik özellikleri için tedarikçi doğrulaması gereklidir.',
  context,
  'Bu sayfadaki model bilgileri tedarikçi kataloğunda listelenen ürün adı'+(sku?' ve '+sku+' kodu':'')+' üzerinden hazırlanmıştır; doğrulanmamış teknik özellikler eklenmemiştir.'
 ];
 return {short:parts.slice(0,2).join(' '),description:parts.join('\n\n'),facts,source:sourceTag(product),reviewed:false};
}
export function productContent(product,category){
 const approved=product?.content&&product.content.review_status==='approved'&&
  String(product.content.description||'').trim().length>=80;
 const fallback=fallbackProductContent(product,category);
 if(!approved)return fallback;
 const c=product.content;
 const specific=Object.entries(c.specifications||{}).filter(([key,value])=>
  typeof key==='string'&&key.length<80&&
  (typeof value==='string'||typeof value==='number')&&String(value).length<160
 ).slice(0,18).map(([label,value])=>({label,value:String(value),from:'Onaylı tedarikçi kaydı'}));
 return {short:normalized(c.short_description)||fallback.short,
  description:String(c.description).trim(),facts:specific.length?specific:fallback.facts,
  source:sourceTag(product),reviewed:true};
}
