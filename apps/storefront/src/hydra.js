import './hydra.css';
import { configured, publishedProducts, publicSourceCatalog, hydraSettings, hydraMerchandising, submitQuoteRequest } from './supabase.js';

const by = s => document.querySelector(s);
const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = value => new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(value);
const groups = [
  {id:'all',name:'Tüm ürünler',headline:'Bütün bakır ürünler',sub:'Koleksiyonun tamamı',photo:'10397022'},
  {id:'cezve',name:'Bakır cezveler',headline:'Kahve ritüeli',sub:'Cezve ve kahve kültürü',photo:'28554501'},
  {id:'caydanlik',name:'Bakır çaydanlıklar',headline:'Çay saati',sub:'Çaydanlık ve demlikler',photo:'34391572'},
  {id:'tencere',name:'Tencere & tava',headline:'Mutfağın ustaları',sub:'Tencere, sahan ve tavalar',photo:'35225640'},
  {id:'sunum',name:'Sofra & sunum',headline:'Sofrada fark yaratanlar',sub:'Tepsi, tabak ve servis parçaları',photo:'2610820'},
  {id:'dekor',name:'Dekoratif bakır',headline:'Yaşam alanlarına bakır',sub:'Mumluk, vazo ve aksesuarlar',photo:'16770951'},
  {id:'sofra',name:'Diğer bakır ürünler',headline:'Keşfedilecek daha çok şey',sub:'Özel koleksiyonlar ve tamamlayıcılar',photo:'17205592'}
];
const groupById = Object.fromEntries(groups.map(x=>[x.id,x]));
// Every storefront category surface follows the same saved Hydra merchandising order.
// "Tüm ürünler" stays first; unchecked categories remain accessible at the end.
function orderedGroups(){
 const available=groups.slice(1).map(g=>g.id);
 const configuredOrder=Array.isArray(state.settings?.featured_categories)?state.settings.featured_categories:[];
 const ordered=[...new Set(configuredOrder.filter(id=>available.includes(id)))];
 return [groupById.all,...[...ordered,...available.filter(id=>!ordered.includes(id))].map(id=>groupById[id])];
}
function syncCategoryNavigation(){
 const ids=orderedGroups().slice(1).map(g=>g.id);
 for(const selector of ['.hy-nav .hy-container','#hy-mobile-menu']){
  const parent=document.querySelector(selector);
  if(!parent)return;
  const info=selector.startsWith('.hy-nav')?parent.querySelector('.hy-nav-info'):null;
  for(const id of ids){
   const link=parent.querySelector('a[href="#/catalog/'+id+'"]');
   if(!link)continue;
   if(info)parent.insertBefore(link,info);
   else parent.appendChild(link);
  }
 }
}
const patterns = {
  sunum:/tepsi|tabak|sunum|servis|şekerlik|sekerlik|lokum|fincan|sosluk|baharatlık|baharatlik|kase|kâse|çerez|cerez|bardak|sürahi|surahi|buz kovası|buz kovasi/i,
  dekor:/mumluk|tütsülük|tutsuluk|buhurdan|vazo|dekor|şamdan|samdan|saksı|saksi|abajur|şömine|somine|biblo|hediyelik|duvar|çiçeklik|ciceklik/i
};
const storageKey='bm.hydra.interest.v1', favoriteKey='bm.hydra.favorites.v1';
function readIds(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return new Set(Array.isArray(v)?v.filter(x=>typeof x==='string').slice(0,250):[])}catch{return new Set()}}
const interest=readIds(storageKey),favorites=readIds(favoriteKey),compare=readIds('bm.hydra.compare.v1');
const state={products:[],loading:true,error:'',sort:'featured',filterOpen:false,drawer:false,zoom:false,settings:{hero_title:'Mutfağınıza bakırın en güzel hâli.',hero_subtitle:'İster kahve ritüeli, ister günlük mutfak, ister özel sunum. Aradığınız bakır parçayı kategorisinde, kolayca bulun.',hero_category:'tencere',featured_categories:['cezve','caydanlik','tencere','sunum','dekor']}};
let loadVersion=0;
const getGroup=p=>{
  if(p.display_category&&groupById[p.display_category])return p.display_category;
  if(p.category==='cezve'||p.category==='caydanlik'||p.category==='tencere')return p.category;
  if(patterns.dekor.test(p.name))return 'dekor';
  if(patterns.sunum.test(p.name))return 'sunum';
  return 'sofra';
};
const countFor=id=>state.products.filter(p=>id==='all'||getGroup(p)===id).length;
const photoOf=p=>Array.isArray(p.image_urls)?p.image_urls.find(x=>typeof x==='string'&&/^https:\/\/[^"' <>\s]+$/i.test(x)):null;
const imageOf=(p,cls='',priority=false)=>{
  const url=photoOf(p);
  if(!url)return '<div class="hy-image-placeholder '+cls+'"><span>BAKIR<br>MUTFAK</span><small>Görsel hazırlanıyor</small></div>';
  return '<img class="'+cls+'" src="'+escapeHTML(url)+'" alt="'+escapeHTML(p.name)+'" decoding="async" loading="'+(priority?'eager':'lazy')+'"'+(priority?' fetchpriority="high"':'')+'>';
};
const fallbackImage=id=>'https://images.pexels.com/photos/'+(groupById[id]?.photo||'10397022')+'/pexels-photo-'+(groupById[id]?.photo||'10397022')+'.jpeg?auto=compress&cs=tinysrgb&w=900';
function coverFor(id){
  const p=state.products.find(p=>getGroup(p)===id&&photoOf(p));
  return p?photoOf(p):fallbackImage(id);
}
function productCard(p){
  const liked=favorites.has(p.id),saved=interest.has(p.id);
  return '<article class="hy-product" data-product-id="'+escapeHTML(p.id)+'">'+
    '<div class="hy-product-media"><a href="#/product/'+encodeURIComponent(p.slug)+'" aria-label="'+escapeHTML(p.name)+' ürün detayını aç">'+imageOf(p,'hy-product-image')+'</a>'+
      '<span class="hy-product-badge">'+(p.catalog_only?'Koleksiyon ürünü':'Ürün seçkisi')+'</span>'+
      '<button class="hy-favorite '+(liked?'active':'')+'" data-favorite="'+escapeHTML(p.id)+'" aria-label="'+(liked?'Favorilerden çıkar':'Favorilere ekle')+'" aria-pressed="'+liked+'">'+(liked?'♥':'♡')+'</button><button class="hy-compare-add '+(compare.has(p.id)?'selected':'')+'" data-compare="'+escapeHTML(p.id)+'" aria-label="'+(compare.has(p.id)?'Karşılaştırmadan çıkar':'Karşılaştırmaya ekle')+'" aria-pressed="'+compare.has(p.id)+'">⇄</button></div>'+
    '<div class="hy-product-body"><span class="hy-product-kicker">'+escapeHTML(groupById[getGroup(p)]?.name||'Bakır Mutfak')+'</span>'+
    '<a href="#/product/'+encodeURIComponent(p.slug)+'" class="hy-product-name">'+escapeHTML(p.name)+'</a>'+
    '<div class="hy-product-bottom"><div><strong>'+(p.priceConfirmed?money(p.price):'Fiyat sorunuz')+'</strong><small>'+(p.priceConfirmed?'Fiyat doğrulanıyor · satış kapalı':'Fiyat ve stok teyidi sürüyor')+'</small></div>'+
    '<button class="hy-card-add '+(saved?'added':'')+'" data-interest="'+escapeHTML(p.id)+'" aria-label="'+(saved?'İlgi listesinden çıkar':'İlgi listesine ekle')+'" title="'+(saved?'Listeden çıkar':'İlgi listesine ekle')+'">'+(saved?'✓':'+')+'</button></div></div></article>';
}
function categoryCard(g,index=0){
  const n=countFor(g.id);
  const cover=coverFor(g.id);
  return '<a class="hy-category-tile" href="#/catalog/'+g.id+'"><img src="'+escapeHTML(cover)+'" alt="'+escapeHTML(g.name)+'" loading="lazy" decoding="async"><div class="hy-category-tile-info"><span>'+String(index+1).padStart(2,'0')+' / KOLEKSİYON</span><h3>'+escapeHTML(g.name)+'</h3><small>'+n+' ürün <b aria-hidden="true">↗</b></small></div></a>';
}
function sectionProducts(id,title,subtitle,limit=5){
 const items=state.products.filter(p=>getGroup(p)===id&&photoOf(p)).sort((a,b)=>Number(!!b.featured)-Number(!!a.featured)+(Number(b.sort_priority||0)-Number(a.sort_priority||0))/10000).slice(0,limit);
 if(!items.length)return '';
 return '<section class="hy-section hy-shelf" data-shelf="'+id+'"><div class="hy-container">'+
  '<div class="hy-section-heading"><div><span class="hy-overline">'+escapeHTML(subtitle)+'</span><h2>'+escapeHTML(title)+'</h2></div><a href="#/catalog/'+id+'" class="hy-text-link">Tümünü keşfet <span aria-hidden="true">↗</span></a></div>'+
  '<div class="hy-product-grid hy-shelf-grid">'+items.map(productCard).join('')+'</div></div></section>';
}
function featureBanner(){
 const p=state.products.find(x=>getGroup(x)==='tencere'&&photoOf(x));
 const img=p?photoOf(p):fallbackImage('tencere');
 return '<section class="hy-feature hy-container"><div class="hy-feature-copy"><span class="hy-overline">MUTFAĞIN YENİ GÖZDESİ</span><h2>Bakırın<br><em>karakteri,</em><br>mutfağın ritmi.</h2><p>Yüzlerce farklı model arasından tencere, tava ve sahanları keşfedin.</p><a href="#/catalog/tencere" class="hy-btn hy-btn-light">Koleksiyonu keşfet <span>↗</span></a></div><img src="'+escapeHTML(img)+'" alt="Bakır tencere koleksiyonundan bir örnek" loading="lazy"></section>';
}
function home(){
 const prioritized=state.settings.featured_categories||[];
 const picks=orderedGroups().slice(1,7);
 const heroGroup=state.settings.hero_category||'tencere';
 const heroProduct=state.products.find(p=>getGroup(p)===heroGroup&&photoOf(p))||state.products.find(p=>photoOf(p));
 const heroImage=heroProduct?photoOf(heroProduct):fallbackImage('all');
 return '<div class="hy-home">'+
  '<section class="hy-hero hy-container"><div class="hy-hero-copy"><span class="hy-overline"><span class="hy-sparkle">✦</span> BAKIR MUTFAK · HYDRA COMMERCE</span>'+
  '<h1>'+escapeHTML(state.settings.hero_title).replace(/\bbakırın\b/i,word=>'<em>'+word+'</em>')+'</h1><p>'+escapeHTML(state.settings.hero_subtitle)+'</p>'+
  '<div class="hy-hero-actions"><a href="#/catalog" class="hy-btn hy-btn-primary">Tüm ürünleri keşfet <span>↗</span></a><a href="#/catalog/cezve" class="hy-hero-secondary">Cezvelere göz at →</a></div>'+
  '<div class="hy-hero-stats"><span><strong>'+state.products.length+'</strong><small>katalog ürünü</small></span><span><strong>6</strong><small>ürün grubu</small></span><span class="hy-stats-note">Fiyatlar ve stoklar teyit aşamasında</span></div></div>'+
  '<div class="hy-hero-art"><img src="'+escapeHTML(heroImage)+'" alt="'+escapeHTML(heroProduct?.name||'Bakır Mutfak koleksiyonu')+'" fetchpriority="high" loading="eager">'+
  '<span class="hy-hero-art-mark">BAKIR MUTFAK / KOLEKSİYON 2026</span>'+
  '<a class="hy-hero-art-link" href="#/catalog/tencere">Tencere koleksiyonu <b>↗</b></a></div></section>'+
  '<section class="hy-benefits"><div class="hy-container"><span>✧ <strong>Gerçek ürün görselleri</strong></span><span>◇ <strong>Kategoriye göre kolay keşif</strong></span><span>↗ <strong>Ürünleri listeye kaydet</strong></span></div></section>'+
  '<section class="hy-section hy-categories"><div class="hy-container"><div class="hy-section-heading"><div><span class="hy-overline">ÜRÜN DÜNYASINI KEŞFEDİN</span><h2>Ne arıyorsunuz?</h2></div><a class="hy-text-link" href="#/catalog">Tüm kategoriler ↗</a></div>'+
  '<div class="hy-category-grid">'+picks.map(categoryCard).join('')+'</div></div></section>'+
  (state.settings.featured_categories||[]).filter(id=>groupById[id]).map((id,i)=>sectionProducts(id,groupById[id].headline,groupById[id].name)+(i===1?featureBanner():'' )).join('')+
  '<section class="hy-bottom-story hy-section"><div class="hy-container"><div><span class="hy-overline">BAKIR MUTFAK</span><h2>Çok seçenek.<br><em>Tek adres.</em></h2><p>Koleksiyonumuzdaki ürünleri fotoğrafları, ürün kodları ve kategorileriyle keşfedin. Fiyat ve stok bilgileri netleşene kadar beğendiklerinizi ilgi listenizde saklayın.</p><a href="#/catalog" class="hy-btn hy-btn-primary">Ürünlere göz at ↗</a></div><div class="hy-bottom-story-visual"><img loading="lazy" src="'+escapeHTML(coverFor('cezve'))+'" alt="Bakır cezve koleksiyonu"></div></div></section></div>';
}
function route(){
 const raw=(location.hash||'#/').slice(1);
 const i=raw.indexOf('?');
 const pathname=(i>=0?raw.slice(0,i):raw)||'/';
 const query=new URLSearchParams(i>=0?raw.slice(i+1):'');
 const parts=pathname.split('/').filter(Boolean);
 return {page:parts[0]||'home',id:parts[1],query};
}
function matches(p,group){
 return group==='all'||getGroup(p)===group;
}
function sortItems(items,sort){
 if(sort==='name')return items.sort((a,b)=>a.name.localeCompare(b.name,'tr'));
 if(sort==='name-desc')return items.sort((a,b)=>b.name.localeCompare(a.name,'tr'));
 if(sort==='gallery')return items.sort((a,b)=>(b.image_urls?.length||0)-(a.image_urls?.length||0));
 return items.sort((a,b)=>Number(!!b.featured)-Number(!!a.featured)||(b.sort_priority||0)-(a.sort_priority||0)||Number(!!photoOf(b))-Number(!!photoOf(a)));
}
const PAGE_SIZE=24;
function catalog(id='all',query=new URLSearchParams()){
 const current=groupById[id]?id:'all';
 const search=String(query.get('q')||'').trim().slice(0,120);
 const lower=search.toLocaleLowerCase('tr');
 const sort=['featured','name','name-desc','gallery'].includes(query.get('sort'))?query.get('sort'):'featured';
 const photosOnly=query.get('photos')==='1';
 const filtered=sortItems(state.products.filter(p=>matches(p,current) && (!search||[p.name,p.sku,p.supplier_sku].join(' ').toLocaleLowerCase('tr').includes(lower)) && (!photosOnly||photoOf(p))),sort);
 const pageCount=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));
 const requested=Math.max(1,parseInt(query.get('page')||'1',10)||1);
 const page=Math.min(pageCount,requested);
 const visible=filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
 const base='/catalog/'+current;
 const link=(num)=>'#'+base+'?'+new URLSearchParams({...(search?{q:search}:{}),...(sort!=='featured'?{sort}:{}),...(photosOnly?{photos:'1'}:{}),page:String(num)}).toString();
 const pages=Array.from({length:pageCount},(_,i)=>i+1).filter(n=>n===1||n===pageCount||Math.abs(n-page)<=2);
 const paging=pageCount>1?'<nav class="hy-pagination" aria-label="Ürün sayfaları">'+
  (page>1?'<a href="'+link(page-1)+'" aria-label="Önceki sayfa">‹</a>':'')+
  pages.map((n,i)=> (i>0&&n-pages[i-1]>1?'<span>…</span>':'')+'<a class="'+(n===page?'active':'')+'" href="'+link(n)+'" '+(n===page?'aria-current="page"':'')+'>'+n+'</a>').join('')+
  (page<pageCount?'<a href="'+link(page+1)+'" aria-label="Sonraki sayfa">›</a>':'')+'</nav>':'';
 return '<section class="hy-catalog-head"><div class="hy-container"><nav class="hy-breadcrumb"><a href="#/">Ana sayfa</a><span>›</span> Ürünler</nav><div class="hy-catalog-head-inner"><div><span class="hy-overline">BAKIR MUTFAK / KATALOG</span><h1>'+escapeHTML(groupById[current].name)+'</h1><p>'+escapeHTML(groupById[current].sub)+' · '+filtered.length+' ürün</p></div><span class="hy-catalog-deco">BM</span></div>'+
  '<div class="hy-category-pills">'+orderedGroups().map(g=>'<a href="#/catalog/'+g.id+'" class="'+(g.id===current?'active':'')+'">'+escapeHTML(g.name)+' <small>'+countFor(g.id)+'</small></a>').join('')+'</div></div></section>'+
  '<div class="hy-container hy-catalog-layout"><aside class="hy-sidebar"><div class="hy-sidebar-head"><strong>Kategoriler</strong></div><nav>'+orderedGroups().map(g=>'<a href="#/catalog/'+g.id+'" class="'+(current===g.id?'active':'')+'"><span>'+escapeHTML(g.name)+'</span><small>'+countFor(g.id)+'</small></a>').join('')+'</nav><div class="hy-sidebar-note"><strong>Ürününüzü bulun</strong><p>Ürünleri ilgi listenize ekleyip ürün kodlarını tek seferde kopyalayabilirsiniz.</p></div></aside>'+
  '<div class="hy-results"><div class="hy-results-toolbar"><div><strong>'+filtered.length+' ürün</strong><span>'+(search?'“'+escapeHTML(search)+'” arama sonuçları':'Koleksiyon sonuçları')+'</span></div>'+
  '<button class="hy-mobile-filter" id="hy-filter-toggle" aria-expanded="'+state.filterOpen+'">☷ Filtrele</button>'+
  '<div class="hy-toolbar-fields"><label class="hy-photos-filter"><input type="checkbox" id="hy-photos-only" '+(photosOnly?'checked':'')+'> Görselli ürünler</label><label>Sırala <select id="hy-sort"><option value="featured" '+(sort==='featured'?'selected':'')+'>Önerilen</option><option value="gallery" '+(sort==='gallery'?'selected':'')+'>Çok görselli</option><option value="name" '+(sort==='name'?'selected':'')+'>A–Z</option><option value="name-desc" '+(sort==='name-desc'?'selected':'')+'>Z–A</option></select></label></div></div>'+
  (search?'<div class="hy-search-chip">Arama: '+escapeHTML(search)+' <a href="#/catalog/'+current+'">✕ Temizle</a></div>':'')+
  '<div class="hy-mobile-filter-panel" id="hy-mobile-filter-panel" '+(!state.filterOpen?'hidden':'')+'><strong>Kategori seç</strong>'+orderedGroups().map(g=>'<a href="#/catalog/'+g.id+'">'+escapeHTML(g.name)+' ('+countFor(g.id)+')</a>').join('')+'</div>'+
  '<div class="hy-product-grid hy-catalog-grid">'+visible.map(productCard).join('')+'</div>'+
  (!visible.length?'<div class="hy-no-results"><h3>Bu aramaya uygun ürün bulunamadı.</h3><p>Başka bir kelime deneyebilir veya tüm ürünlere dönebilirsiniz.</p><a class="hy-btn hy-btn-primary" href="#/catalog">Tüm ürünler</a></div>':'')+
  '<div class="hy-pagination-caption">Sayfa '+page+' / '+pageCount+' · '+filtered.length+' ürün</div>'+paging+'</div></div>';
}
function detail(p){
 if(!p)return '<main class="hy-container hy-empty"><h1>Ürün bulunamadı.</h1><a class="hy-btn hy-btn-primary" href="#/catalog">Tüm ürünler</a></main>';
 const images=(p.image_urls||[]).filter(x=>typeof x==='string'&&x.startsWith('https://'));
 const selected=images[0]||'';
 const liked=favorites.has(p.id),saved=interest.has(p.id);
 const similar=state.products.filter(x=>x.id!==p.id&&getGroup(x)===getGroup(p)&&photoOf(x)).slice(0,5);
 return '<main class="hy-container hy-product-page"><nav class="hy-breadcrumb"><a href="#/">Ana sayfa</a><span>›</span><a href="#/catalog/'+getGroup(p)+'">'+escapeHTML(groupById[getGroup(p)].name)+'</a><span>›</span><span>'+escapeHTML(p.name)+'</span></nav>'+
  '<div class="hy-detail-layout"><div class="hy-gallery"><div class="hy-gallery-main" id="hy-gallery-main">'+(selected?'<img src="'+escapeHTML(selected)+'" alt="'+escapeHTML(p.name)+'" id="hy-main-photo">':imageOf(p))+
  (selected?'<button class="hy-zoom" id="hy-zoom" aria-label="Ürün görselini büyüt">⤢</button>':'')+'</div>'+
  (images.length>1?'<div class="hy-gallery-thumbs">'+images.slice(0,8).map((url,i)=>'<button data-photo="'+i+'" class="'+(!i?'active':'')+'" aria-label="Görsel '+(i+1)+'"><img src="'+escapeHTML(url)+'" alt="" loading="lazy"></button>').join('')+'</div>':'')+'</div>'+
  '<div class="hy-detail-info"><span class="hy-overline">'+escapeHTML(groupById[getGroup(p)].name).toLocaleUpperCase('tr')+'</span><h1>'+escapeHTML(p.name)+'</h1>'+
  '<div class="hy-detail-sku">Ürün kodu: <strong>'+escapeHTML(p.supplier_sku||p.sku||'Belirtilmedi')+'</strong> · '+(images.length||0)+' fotoğraf</div>'+
  '<div class="hy-detail-price"><strong>'+(p.priceConfirmed?money(p.price):'Fiyat bilgisi hazırlanıyor')+'</strong><p>Fiyat ve stok bilgileri doğrulama aşamasındadır. Bu ürün için henüz sipariş alınmıyor.</p></div>'+
  '<div class="hy-detail-availability"><span class="hy-status-dot"></span> İncelemeye ve ilgi listesine eklemeye açık</div>'+
  '<div class="hy-detail-actions"><button class="hy-btn hy-btn-primary" data-interest="'+escapeHTML(p.id)+'">'+(saved?'✓ İlgi listesinde':'＋ İlgi listeme ekle')+'</button><button class="hy-detail-heart" data-favorite="'+escapeHTML(p.id)+'" aria-pressed="'+liked+'" aria-label="Favori">'+(liked?'♥':'♡')+'</button><button class="hy-detail-heart" data-compare="'+escapeHTML(p.id)+'" aria-pressed="'+compare.has(p.id)+'" aria-label="Karşılaştır">⇄</button></div>'+
  '<div class="hy-detail-footnotes"><div><span>◇</span> <div><strong>Ürünleri karşılaştırın</strong><small>Beğendiklerinizi ilgi listesinde biriktirin.</small></div></div><div><span>↗</span><div><strong>Teklif hazırlığı</strong><small>Ürün kodlarını tek tuşla kopyalayın.</small></div></div></div>'+
  '<details class="hy-detail-accordion" open><summary>Ürün bilgileri</summary><p>Ürün adı ve görselleri izinli tedarikçi kataloğundan alınmıştır. Fiyat, stok, ölçü ve malzeme detayları henüz ayrıca doğrulanmadı.</p></details>'+
  '<details class="hy-detail-accordion"><summary>Bakır ürünlerde kullanım ve bakım</summary><p>Gıda ile temas eden ürünlerde iç kaplama ve üretici kullanım talimatları kontrol edilmelidir. Bakım talimatları ürüne göre farklılık gösterebilir.</p></details></div></div>'+
  (similar.length?'<section class="hy-section hy-related"><div class="hy-section-heading"><div><span class="hy-overline">BUNLARI DA BEĞENEBİLİRSİNİZ</span><h2>Benzer ürünler</h2></div><a class="hy-text-link" href="#/catalog/'+getGroup(p)+'">Tümünü gör ↗</a></div><div class="hy-product-grid hy-shelf-grid">'+similar.map(productCard).join('')+'</div></section>':'')+'</main>';
}

function comparison(){
 const items=state.products.filter(p=>compare.has(p.id)).slice(0,3);
 if(!items.length)return '<main class="hy-container hy-collection-page"><h1>Ürün karşılaştırma</h1><div class="hy-empty"><p>Karşılaştırmak için ürün kartlarındaki ⇄ işaretini seçin (en fazla 3 ürün).</p><a class="hy-btn hy-btn-primary" href="#/catalog">Ürünlere dön</a></div></main>';
 const cell=(title,fn)=>'<tr><th>'+title+'</th>'+items.map(p=>'<td>'+fn(p)+'</td>').join('')+'</tr>';
 return '<main class="hy-container hy-collection-page"><span class="hy-overline">HYDRA / ÜRÜN KARŞILAŞTIRMA</span><h1>Yan yana karşılaştırın.</h1><p class="hy-compare-intro">En fazla üç modelin görsellerini, kategori ve ürün kodlarını karşılaştırabilirsiniz. Doğrulanmamış fiyat veya malzeme bilgisi gösterilmez.</p><div class="hy-compare-scroll"><table class="hy-compare-table"><tbody>'+
 cell('Fotoğraf',p=>'<a href="#/product/'+encodeURIComponent(p.slug)+'">'+imageOf(p,'hy-compare-image')+'</a>')+
 cell('Ürün',p=>'<a href="#/product/'+encodeURIComponent(p.slug)+'"><strong>'+escapeHTML(p.name)+'</strong></a>')+
 cell('Kategori',p=>escapeHTML(groupById[getGroup(p)]?.name||''))+
 cell('Ürün kodu',p=>escapeHTML(p.supplier_sku||p.sku||'—'))+
 cell('Fotoğraf sayısı',p=>String(p.image_urls?.length||0))+
 cell('Satış durumu',()=> 'Fiyat ve stok teyit ediliyor')+
 cell('İşlemler',p=>'<button class="hy-btn hy-btn-primary" data-interest="'+escapeHTML(p.id)+'">İlgi listeme ekle</button> <button data-compare="'+escapeHTML(p.id)+'" class="hy-compare-remove">Çıkar ✕</button>')+
 '</tbody></table></div></main>';
}

function wishlist(){
 const items=state.products.filter(x=>favorites.has(x.id));
 return '<main class="hy-container hy-collection-page"><nav class="hy-breadcrumb"><a href="#/">Ana sayfa</a><span>›</span> Favorilerim</nav><span class="hy-overline">KİŞİSEL KOLEKSİYONUNUZ</span><h1>Favorilerim <small>'+items.length+'</small></h1>'+
  (items.length?'<div class="hy-product-grid hy-catalog-grid">'+items.map(productCard).join('')+'</div>':'<div class="hy-empty"><h2>Henüz favori ürününüz yok.</h2><p>Kalp simgesine dokunarak sevdiğiniz ürünleri burada saklayabilirsiniz.</p><a href="#/catalog" class="hy-btn hy-btn-primary">Koleksiyonu keşfet ↗</a></div>')+'</main>';
}
function showDrawer(){
 state.drawer=true;
 const items=state.products.filter(x=>interest.has(x.id));
 by('#hy-shade').hidden=false;
 by('#hy-drawer').classList.add('open');
 by('#hy-drawer').setAttribute('aria-hidden','false');
 by('#hy-drawer-items').innerHTML=items.length?items.map(p=>
  '<div class="hy-drawer-item">'+imageOf(p,'hy-drawer-thumb')+'<div><a href="#/product/'+encodeURIComponent(p.slug)+'">'+escapeHTML(p.name)+'</a><small>'+escapeHTML(p.supplier_sku||p.sku||'')+'</small><button data-interest="'+escapeHTML(p.id)+'">Listeden çıkar ✕</button></div></div>').join(''):'<div class="hy-empty"><h3>İlgi listeniz henüz boş.</h3><p>Ürünlerdeki + düğmesine basarak ekleme yapabilirsiniz.</p></div>';
 by('#hy-interest-count').textContent=items.length;
 by('#hy-drawer-count').textContent=items.length;
 by('#hy-copy-list').disabled=!items.length;
 by('#hy-open-quote').disabled=!items.length;
}
function closeDrawer(){state.drawer=false;by('#hy-shade').hidden=true;by('#hy-drawer').classList.remove('open');by('#hy-drawer').setAttribute('aria-hidden','true')}
function refreshCounters(){
 by('#hy-interest-count').textContent=interest.size;
 by('#hy-favorites-count').textContent=favorites.size;
 const tray=by('#hy-compare-tray');if(tray){tray.hidden=!compare.size;by('#hy-compare-count').textContent=compare.size;}
}
function toggle(set,key,id){
 if(set.has(id))set.delete(id);else set.add(id);
 try{localStorage.setItem(key,JSON.stringify([...set]))}catch{}
 render();
 if(state.drawer)showDrawer();
}
function navigateHash(path){const next='#'+path;if(location.hash===next)render();else location.hash=next}
function changeQuery(key,value){
 const r=route();const q=new URLSearchParams(r.query);
 if(value)q.set(key,value);else q.delete(key);
 q.delete('page');navigateHash('/catalog/'+(groupById[r.id]?r.id:'all')+(q.size?'?'+q.toString():''));
}
function render(){
 const r=route();
 const root=by('#hy-app');
 let content;
 if(state.loading)content='<section class="hy-loading"><div class="hy-container"><span class="hy-overline">BAKIR MUTFAK</span><h1>Koleksiyon yükleniyor…</h1><div class="hy-loading-bar"></div></div></section>';
 else if(state.error)content='<section class="hy-error hy-container"><h1>Koleksiyon yüklenemedi.</h1><p>'+escapeHTML(state.error)+'</p><button class="hy-btn hy-btn-primary" id="hy-retry">Yeniden dene</button></section>';
 else if(r.page==='catalog')content=catalog(r.id||'all',r.query);
 else if(r.page==='product')content=detail(state.products.find(x=>x.slug===decodeURIComponent(r.id||'')));
 else if(r.page==='favorites')content=wishlist();
 else if(r.page==='compare')content=comparison();
 else content=home();
 root.innerHTML=content;
 syncCategoryNavigation();
 const title=r.page==='product'?state.products.find(x=>x.slug===r.id)?.name:r.page==='catalog'?groupById[r.id||'all']?.name:r.page==='favorites'?'Favorilerim':r.page==='compare'?'Karşılaştırma':'Bakır Mutfak';
 document.title=(title||'Bakır Mutfak')+' | Bakır Mutfak';
 refreshCounters();
 by('#hy-mobile-menu').hidden=true;
 if(r.page==='catalog'){
  const input=by('#hy-sort');if(input)input.onchange=e=>changeQuery('sort',e.target.value==='featured'?'':e.target.value);
  const photoToggle=by('#hy-photos-only');if(photoToggle)photoToggle.onchange=e=>changeQuery('photos',e.target.checked?'1':'');
  const filterButton=by('#hy-filter-toggle');if(filterButton)filterButton.onclick=()=>{state.filterOpen=!state.filterOpen;filterButton.setAttribute('aria-expanded',String(state.filterOpen));by('#hy-mobile-filter-panel').hidden=!state.filterOpen};
 }
 if(r.page==='product'){
  const p=state.products.find(x=>x.slug===r.id);
  const imgs=p?.image_urls||[];
  document.querySelectorAll('[data-photo]').forEach(b=>b.onclick=()=>{
   const selected=imgs[Number(b.dataset.photo)];if(!selected)return;
   by('#hy-main-photo').src=selected;
   document.querySelectorAll('[data-photo]').forEach(t=>t.classList.toggle('active',t===b));
  });
  const zoom=by('#hy-zoom');if(zoom)zoom.onclick=()=>{
    const el=by('#hy-main-photo');if(!el)return;
    by('#hy-lightbox-image').src=el.src;
    by('#hy-lightbox-image').alt=p.name;
    by('#hy-lightbox').hidden=false;
  };
 }
 const retry=by('#hy-retry');if(retry)retry.onclick=loadData;
}
function attachEvents(){
 document.addEventListener('click',e=>{
  const fav=e.target.closest('[data-favorite]');
  if(fav){e.preventDefault();toggle(favorites,favoriteKey,fav.dataset.favorite);return;}
  const add=e.target.closest('[data-interest]');
  if(add){e.preventDefault();toggle(interest,storageKey,add.dataset.interest);return;}
  const toggleCompare=e.target.closest('[data-compare]');
  if(toggleCompare){e.preventDefault();const id=toggleCompare.dataset.compare;if(!compare.has(id)&&compare.size>=3){alert('En fazla 3 ürünü karşılaştırabilirsin.');return;}toggle(compare,'bm.hydra.compare.v1',id);return;}
 });
 by('#hy-search-input').addEventListener('input',searchSuggestions);
 by('#hy-search').onsubmit=e=>{
  e.preventDefault();const value=by('#hy-search-input').value.trim();
  by('#hy-search-suggestions').hidden=true;
  navigateHash('/catalog/all'+(value?'?'+new URLSearchParams({q:value}).toString():''));
 };
 by('#hy-menu-toggle').onclick=()=>{const m=by('#hy-mobile-menu');m.hidden=!m.hidden;by('#hy-menu-toggle').setAttribute('aria-expanded',String(!m.hidden))};
 by('#hy-interest-trigger').onclick=showDrawer;
 by('#hy-mobile-interest').onclick=showDrawer;
 by('#hy-compare-launch').onclick=()=>navigateHash('/compare');
 by('#hy-drawer-close').onclick=closeDrawer;
 by('#hy-open-quote').onclick=openQuoteForm;
 by('#hy-quote-close').onclick=closeQuoteForm;
 by('#hy-quote-modal').onclick=e=>{if(e.target.id==='hy-quote-modal')closeQuoteForm();};
 by('#hy-quote-cancel').onclick=closeQuoteForm;
 by('#hy-quote-form').onsubmit=submitQuoteForm;
 by('#hy-shade').onclick=closeDrawer;
 by('#hy-lightbox-close').onclick=()=>by('#hy-lightbox').hidden=true;
 by('#hy-lightbox').onclick=e=>{if(e.target.id==='hy-lightbox')by('#hy-lightbox').hidden=true};
 by('#hy-copy-list').onclick=async()=>{
  const items=state.products.filter(x=>interest.has(x.id));
  const copyText='BAKIR MUTFAK · İLGİ LİSTESİ\n'+items.map((p,i)=>(i+1)+'. '+p.name+' · SKU: '+(p.supplier_sku||p.sku||'')+'\n'+(p.source_url||'')).join('\n\n')+'\nFiyat, stok ve sipariş bilgileri henüz teyit edilmemiştir.';
  try{await navigator.clipboard.writeText(copyText);by('#hy-copy-list').textContent='✓ Liste kopyalandı';}
  catch{by('#hy-copy-list').textContent='Kopyalanamadı';}
 };
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();closeQuoteForm();by('#hy-lightbox').hidden=true;by('#hy-search-suggestions').hidden=true;}});
 window.addEventListener('hashchange',()=>{closeDrawer();state.filterOpen=false;render();window.scrollTo({top:0,behavior:'instant'})});
}
async function loadData(){
 const version=++loadVersion;
 state.loading=true;state.error='';render();
 if(!configured){state.products=[];state.loading=false;render();return;}
 try{
  const [retail,catalogItems,settingsResult,merchResult]=await Promise.all([publishedProducts(),publicSourceCatalog(),hydraSettings().catch(()=>null),hydraMerchandising().catch(()=>[])]);
  if(version!==loadVersion)return;
  const first=(retail||[]).map(p=>({...p,id:String(p.id),slug:p.slug||String(p.id),catalog_only:false,priceConfirmed:false,image_urls:p.image_urls||[]}));
  const second=(catalogItems||[]).map(p=>({...p,id:String(p.id),slug:'catalog-'+p.id,catalog_only:true,priceConfirmed:false,price:null,stock:null,sku:p.supplier_sku||'',image_urls:p.image_urls||[]}));
  if(settingsResult)state.settings={...state.settings,...settingsResult};
  const overrides=new Map((merchResult||[]).map(x=>[x.product_id,x]));
  state.products=[...second.map(p=>({...p,...(overrides.get(p.id)||{})})),...first].filter(p=>!p.hidden_from_storefront);
  state.loading=false;render();
 }catch(e){if(version!==loadVersion)return;state.loading=false;state.error=e.message||'Bir bağlantı hatası oluştu.';render();}
}

function openQuoteForm(){
 closeDrawer();
 const modal=by('#hy-quote-modal'),form=by('#hy-quote-form');
 const count=state.products.filter(p=>interest.has(p.id)).length;
 if(count>20){alert('Teklif formuna en fazla 20 ürün eklenebilir. İlgi listenizi 20 ürüne indirin.');return;}
 by('#hy-quote-product-count').textContent=String(count);
 by('#hy-quote-feedback').hidden=true;
 form.hidden=false;
 modal.hidden=false;
 form.querySelector('input[name="name"]').focus();
}
function closeQuoteForm(){by('#hy-quote-modal').hidden=true;}
async function submitQuoteForm(e){
 e.preventDefault();
 const form=e.currentTarget,fd=new FormData(form),feedback=by('#hy-quote-feedback');
 const items=state.products.filter(p=>interest.has(p.id)).slice(0,20);
 if(!items.length){feedback.hidden=false;feedback.textContent='Önce bir ürün eklemelisiniz.';return;}
 const submit=form.querySelector('button[type=submit]');
 submit.disabled=true;submit.textContent='Talep gönderiliyor…';
 try{
  const result=await submitQuoteRequest({
   name:fd.get('name'),email:fd.get('email'),phone:fd.get('phone'),
   message:fd.get('message'),website:fd.get('website'),
   product_ids:items.map(x=>x.id),consent:fd.has('consent')
  });
  feedback.hidden=false;feedback.className='hy-quote-feedback success';
  feedback.textContent='Talebiniz başarıyla kaydedildi. Referans: '+String(result.reference||'alındı').slice(0,8)+'. Satış veya ödeme işlemi oluşturulmadı.';
  form.reset();form.hidden=true;
 }catch(error){feedback.hidden=false;feedback.className='hy-quote-feedback error';feedback.textContent=error.message||'Talep gönderilemedi.';}
 finally{submit.disabled=false;submit.textContent='Teklif talebini gönder ↗';}
}
function searchSuggestions(){
 const input=by('#hy-search-input'),target=by('#hy-search-suggestions');
 const phrase=input.value.trim().toLocaleLowerCase('tr');
 if(phrase.length<2){target.hidden=true;return;}
 const found=state.products.filter(p=>(p.name+' '+(p.supplier_sku||p.sku||'')).toLocaleLowerCase('tr').includes(phrase)).slice(0,6);
 target.innerHTML=found.length?
 '<span class="hy-suggest-label">ÜRÜN ÖNERİLERİ</span>'+
 found.map(p=>'<a href="#/product/'+encodeURIComponent(p.slug)+'">'+imageOf(p,'hy-suggest-image')+'<span>'+escapeHTML(p.name)+'<small>'+escapeHTML(groupById[getGroup(p)]?.name||'')+'</small></span><b>↗</b></a>').join('')+
 '<a href="#/catalog/all?q='+encodeURIComponent(input.value.trim())+'" class="hy-suggest-all">Tüm sonuçları göster →</a>':
 '<p>Bu kelimeyle eşleşen ürün bulunamadı.</p>';
 target.hidden=false;
 target.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{target.hidden=true;}));
}

attachEvents();
loadData();
