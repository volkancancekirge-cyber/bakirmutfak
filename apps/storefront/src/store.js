import './styles.css';
import {configured, publishedProducts} from './supabase.js';

const $=s=>document.querySelector(s);
const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const format=n=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(n||0);
const categories={all:'Tüm Ürünler',cezve:'Cezve & Kahve',caydanlik:'Çaydanlık',tencere:'Tencere & Sahan',sofra:'Sofra & Sunum'};
const samples=[
{sku:'DEMO-CEZ-01',slug:'el-dovmesi-bakir-cezve',name:'El Dövmesi Bakır Cezve',price:1290,stock:9,category:'cezve',product_type:'cezve',material:'Kalaylı bakır',size_label:'350 ml',handmade:true,tinned:true,subtitle:'Kahve geleneğinin yeni yorumu',badge:'ÇOK SEVİLEN',image_urls:[]},
{sku:'DEMO-CAY-02',slug:'bakir-caydanlik',name:'Dövme Bakır Çaydanlık',price:3850,stock:4,category:'caydanlik',product_type:'caydanlik',material:'Bakır',size_label:'1,4 L',handmade:true,tinned:false,subtitle:'Sofraların klasik ritüeli',badge:'YENİ',image_urls:[]},
{sku:'DEMO-TEN-03',slug:'kapakli-bakir-tencere',name:'Kapaklı Bakır Tencere',price:2790,stock:5,category:'tencere',product_type:'tencere',material:'Kalaylı bakır',size_label:'20 cm',handmade:true,tinned:true,subtitle:'Gelenekten ilham alan lezzet',badge:'',image_urls:[]},
{sku:'DEMO-SOF-04',slug:'bakir-sunum-tepsisi',name:'Bakır Sunum Tepsisi',price:1790,stock:3,category:'sofra',product_type:'tepsi',material:'İşlemeli bakır',size_label:'32 cm',handmade:true,tinned:false,subtitle:'Her sunuma eşsiz dokunuş',badge:'ÖZEL SERİ',image_urls:[]},
{sku:'DEMO-CEZ-05',slug:'uzun-sapli-bakir-cezve',name:'Uzun Saplı Bakır Cezve',price:990,stock:10,category:'cezve',product_type:'cezve',material:'Kalaylı bakır',size_label:'250 ml',handmade:false,tinned:true,subtitle:'Küçük mutluluklara özel',badge:'',image_urls:[]},
{sku:'DEMO-TEN-06',slug:'bakir-sahan',name:'El Dövmesi Bakır Sahan',price:1490,stock:0,category:'tencere',product_type:'sahan',material:'Kalaylı bakır',size_label:'18 cm',handmade:true,tinned:true,subtitle:'Kahvaltı sofralarına yakışır',badge:'TÜKENDİ',image_urls:[]}
];
let products=configured?[]:samples;
let term='',inStock=false,handmade=false,tinned=false,sort='featured',category='all',basket={};
try{basket=JSON.parse(localStorage.getItem('bakirmutfak-basket')||'{}')||{}}catch{}
const art=(p,extra='')=>{
  const u=(p.image_urls||[]).find(v=>/^https:\/\/[^<>"'\s]+$/i.test(v));
  if(u)return '<div class="art '+extra+'"><img src="'+escapeHTML(u)+'" alt="'+escapeHTML(p.name||'Bakır ürün')+'" loading="lazy"/></div>';
  return '<div class="art art-'+escapeHTML(p.product_type||'cezve')+' '+extra+'" aria-label="Temsili bakır ürün görseli"><i class="art-shadow"></i><i class="art-body"></i><i class="art-handle"></i><i class="art-lid"></i><i class="art-knob"></i></div>';
};
const card=p=>'<article class="product"><a class="photo" href="#/product/'+encodeURIComponent(p.slug)+'">'+(p.badge?'<span class="ribbon">'+escapeHTML(p.badge)+'</span>':'')+art(p)+'</a><div class="product-meta"><span class="eyebrow">'+escapeHTML(categories[p.category]||'Bakır Mutfak')+'</span><a href="#/product/'+encodeURIComponent(p.slug)+'" class="product-name">'+escapeHTML(p.name)+'</a><small>'+escapeHTML(p.subtitle||p.material||'Özenli bakır seçkisi')+'</small><div class="price-row"><strong>'+format(p.price)+'</strong><button aria-label="'+escapeHTML(p.name)+' sepete ekle" data-add="'+escapeHTML(p.sku)+'" '+(p.stock?'':'disabled')+'>＋</button></div></div></article>';
const sections=(caption,title,right,href)=>'<div class="section-head"><div><span class="eyebrow">'+caption+'</span><h2>'+title+'</h2></div><a class="underlink" href="'+href+'">'+right+' ↗</a></div>';

const discovery=[
  {category:'cezve',number:'01',tag:'KAHVE RİTÜELİ',name:'Bakır Cezveler',copy:'Her fincanda ayrı bir ritüel.',shape:'cezve'},
  {category:'caydanlik',number:'02',tag:'ÇAY SAATİ',name:'Bakır Çaydanlıklar',copy:'Klasik bir sofranın çağdaş yorumu.',shape:'caydanlik'},
  {category:'tencere',number:'03',tag:'MUTFAK KÜLTÜRÜ',name:'Tencere & Sahan',copy:'Birlikte hazırlanan sofralar için.',shape:'tencere'},
  {category:'sofra',number:'04',tag:'SUNUMUN SANATI',name:'Sofra & Sunum',copy:'Küçük detayların büyük etkisi.',shape:'tepsi'}
];
function discoveryCard(d){
  return \`<a href="#/catalog/\${d.category}" class="discovery-card discovery-\${d.category}" aria-label="\${d.name} koleksiyonunu aç">
    <div class="discovery-top"><span>\${d.number} / \${d.tag}</span><span aria-hidden="true">↗</span></div>
    \${art({product_type:d.shape},'discovery-art')}
    <div class="discovery-bottom"><div><h3>\${d.name}</h3><p>\${d.copy}</p></div><span class="discovery-arrow" aria-hidden="true">↗</span></div>
  </a>\`;
}
function exploreCard(d){
 return \`<a class="explore-card" href="#/catalog/\${d.category}">
    <span class="explore-number">\${d.number} / KOLEKSİYON REHBERİ</span>
    \${art({product_type:d.shape},'explore-art')}
    <div class="explore-bottom"><h3>\${d.name}</h3><span>Keşfet ↗</span></div>
  </a>\`;
}
function home(){
  const recommendations=products.length ? products.slice(0,4).map(card).join('') : '';
  const more=products.length<4?discovery.slice(0,4-products.length).map(exploreCard).join(''):'';
  return \`
    <section class="hero signature-hero" aria-label="Bakır Mutfak Signature">
      <div class="hero-info">
        <span class="eyebrow"><span class="tiny-diamond" aria-hidden="true">✦</span> BAKIR MUTFAK — SIGNATURE / 2026</span>
        <h1>Zamana<br>dokunan <em>bakır.</em></h1>
        <p>Ustalığın izinden, sofranın kalbine. Bakırın sıcaklığını, doğal dokusunu ve zamansız karakterini modern yaşamla buluşturan bir seçki.</p>
        <div class="hero-actions"><a class="btn dark hero-cta" href="#/catalog">Koleksiyonu Keşfet <span aria-hidden="true">↗</span></a><a class="underlink" href="#/story">Bakırın hikâyesi →</a></div>
        <span class="hero-count">✳ &nbsp; TASARIM. ZANAAT. SOFRA.</span>
      </div>
      <div class="hero-visual signature-visual">
        <div class="hero-halo"></div><div class="signature-orbit" aria-hidden="true"></div>
        <span class="signature-vertical">THE ART OF COPPER · BAKIR MUTFAK</span>
        \${art({product_type:'tencere'},'hero-art')}
        <div class="signature-stamp"><strong>BM</strong><span>SIGNATURE</span></div>
        <div class="hero-footnote"><span>BAKIRIN ZAMANSIZ ESTETİĞİ</span><span>01 — 04</span></div>
      </div>
    </section>
    <div class="trust signature-trust" aria-label="Mağaza özellikleri"><span>✳ &nbsp; Özenli ürün seçkisi</span><span>◇ &nbsp; Malzeme ve ölçü bilgileri</span><span>↗ &nbsp; Kolay koleksiyon keşfi</span></div>
    <section class="opening-statement container"><span class="eyebrow">BAKIR MUTFAK / BİR TASARIM YAKLAŞIMI</span>
      <div><h2>Bir malzeme. <em>Bin hikâye.</em></h2><p>Bakırın karakterini öne çıkaran sade formlar, sıcak tonlar ve gündelik hayatın ritüelleri. Her koleksiyonu kendi hikâyesiyle keşfedin.</p></div>
    </section>
    <section class="container section signature-collections" id="koleksiyonlar">
      \${sections('KOLEKSİYONLAR / 01—04','Bakırın dört farklı<br><em>yorumu.</em>','Tüm ürünleri gör','#/catalog')}
      <div class="discovery-grid">\${discovery.map(discoveryCard).join('')}</div>
    </section>
    <section class="craft-stage" aria-label="Malzemenin karakteri">
      <div class="craft-visual"><div class="craft-light"></div>\${art({product_type:'sahan'},'craft-art')}<span class="craft-visual-label">COPPER / THE MATERIAL</span></div>
      <div class="craft-copy"><span class="eyebrow">MALZEMENİN KARAKTERİ</span><h2>Yalnızca<br>parlaklığı değil.<br><em>Dokusu da.</em></h2>
        <p>Bakırın sıcak rengi, zamanla değişen yüzeyi ve geleneksel mutfak kültüründeki yeri; bir objeden fazlasını düşündürür.</p>
        <a class="underlink craft-link" href="#/story">Malzemeyi daha yakından tanı ↗</a>
        <span class="craft-issue">BAKIR MUTFAK JOURNAL &nbsp; / &nbsp; NO. 001</span>
      </div>
    </section>
    <section class="section featured-signature">
      <div class="container">
        \${sections('MAĞAZADAN SEÇKİLER','Sofranın yeni<br><em>favorileri.</em>','Kataloğu incele','#/catalog')}
        <div class="featured-intro"><span>Yayımlanan ürünleri ve koleksiyon keşiflerini bir arada görün.</span><span>\${products.length} YAYIMLANMIŞ ÜRÜN</span></div>
        <div class="product-grid signature-products">\${recommendations}\${more}</div>
        \${products.length<4?'<p class="collection-disclaimer">Koleksiyon kartları ürün ilanı değildir; ürün ve fiyat bilgileri eklendikçe gerçek ürünlerle yer değiştirecek.</p>':''}
      </div>
    </section>
    <section class="principles container section" aria-labelledby="principles-title">
      <div class="principles-title"><span class="eyebrow">BAKIR REHBERİ</span><h2 id="principles-title">Güzellik,<br><em>detaylarda saklı.</em></h2><p>Bakır ürün seçerken dikkat edebileceğiniz üç küçük ayrıntı.</p></div>
      <div class="principles-grid">
        <article><span class="principle-number">01 / MALZEME</span><span class="principle-icon">✧</span><h3>Yüzey & doku</h3><p>Bakırın görünümü ve yüzey işlemi ürünün kullanım amacına göre farklılık gösterebilir.</p></article>
        <article><span class="principle-number">02 / KULLANIM</span><span class="principle-icon">◈</span><h3>İç kaplama</h3><p>Gıda ile temas eden kaplarda iç kaplamayı ve üreticinin kullanım talimatını mutlaka kontrol edin.</p></article>
        <article><span class="principle-number">03 / BAKIM</span><span class="principle-icon">✳</span><h3>Uzun ömür</h3><p>Ürüne uygun bakım, nazik temizlik ve doğru saklama bakır eşyanın görünümünü korumaya yardımcı olur.</p></article>
      </div>
    </section>
    <section class="signature-finale"><div class="signature-finale-inner"><span class="eyebrow">ATÖLYEDEN SOFRAYA</span><h2>Günlük hayatın<br><em>kalıcı parçaları.</em></h2><p>Bakır Mutfak koleksiyonlarını keşfedin ve sofranıza yakışan parçayı bulun.</p><a href="#/catalog" class="btn light">Tüm koleksiyonlar ↗</a></div><div class="finale-ornament" aria-hidden="true">✳</div></section>
  \`;
}
const filter=()=>{const out=products.filter(p=>(category==='all'||p.category===category)&&(!term||[p.name,p.sku,p.subtitle,p.description].join(' ').toLocaleLowerCase('tr').includes(term.toLocaleLowerCase('tr')))&&(!inStock||p.stock>0)&&(!handmade||p.handmade)&&(!tinned||p.tinned));
if(sort==='low')out.sort((a,b)=>a.price-b.price);if(sort==='high')out.sort((a,b)=>b.price-a.price);return out};
function catalog(c='all'){
category=categories[c]?c:'all';const list=filter();
return '<div class="catalog-hero"><div class="container"><span class="eyebrow">BAKIR MUTFAK · KOLEKSİYON</span><h1>'+escapeHTML(categories[category])+'</h1><p>Zanaatin izini taşıyan bakır ürünleri, ihtiyacınıza göre keşfedin.</p><div class="chips">'+Object.entries(categories).map(([id,name])=>'<a class="'+(id===category?'on':'')+'" href="#/catalog/'+(id==='all'?'':id)+'">'+name+'</a>').join('')+'</div></div></div><div class="container catalog-body"><aside class="filters"><div class="filters-title">FİLTRELER <button id="clear">Temizle</button></div><label><input type="checkbox" id="stock" '+(inStock?'checked':'')+'/> Stokta olanlar</label><label><input type="checkbox" id="handmade" '+(handmade?'checked':'')+'/> El işçiliği</label><label><input type="checkbox" id="tinned" '+(tinned?'checked':'')+'/> Kalaylı iç yüzey</label><label class="search-label">Ürün ara<input type="search" id="term" placeholder="Cezve, tencere..." value="'+escapeHTML(term)+'"/></label></aside><div class="results"><div class="result-tools"><span id="count">'+list.length+' ürün</span><label>Sıralama <select id="sort"><option value="featured">Önerilen</option><option value="low" '+(sort==='low'?'selected':'')+'>Fiyat artan</option><option value="high" '+(sort==='high'?'selected':'')+'>Fiyat azalan</option></select></label></div><div class="product-grid catalog-grid" id="catalog-grid">'+list.map(card).join('')+'</div><p id="empty" '+(list.length?'hidden':'')+'>Bu filtrelere uygun ürün bulunamadı.</p></div></div>';
}
function detail(p){
if(!p)return '<div class="container section"><h1>Ürün bulunamadı.</h1><a class="btn dark" href="#/catalog">Koleksiyona dön</a></div>';
const photo=(p.image_urls||[]).filter(x=>/^https:\/\//.test(x));
return '<div class="container"><div class="breadcrumbs"><a href="#/">Ana sayfa</a> / <a href="#/catalog/'+p.category+'">'+escapeHTML(categories[p.category])+'</a> / '+escapeHTML(p.name)+'</div><div class="detail"><div class="detail-photo">'+(photo.length?photo.map(u=>'<img alt="'+escapeHTML(p.name)+'" src="'+escapeHTML(u)+'" loading="lazy"/>').join(''):art(p))+'</div><div class="detail-copy"><span class="eyebrow">BAKIR MUTFAK · SIGNATURE</span><h1>'+escapeHTML(p.name)+'</h1><p>'+escapeHTML(p.subtitle||'Özenle seçilmiş bakır ürün')+'</p><strong class="detail-price">'+format(p.price)+'</strong><p class="fineprint">Geliştirme sürümü · Sipariş ve ödeme henüz aktif değildir.</p><dl><dt>Malzeme</dt><dd>'+escapeHTML(p.material||'Bilgi eklenecek')+'</dd><dt>Ölçü</dt><dd>'+escapeHTML(p.size_label||'Bilgi eklenecek')+'</dd><dt>Stok</dt><dd>'+(p.stock>0?p.stock+' adet':'Tükendi')+'</dd><dt>SKU</dt><dd>'+escapeHTML(p.sku)+'</dd></dl><button class="btn dark full" data-add="'+escapeHTML(p.sku)+'" '+(p.stock?'':'disabled')+'>Sepete ekle ↗</button><details open><summary>ÜRÜN AÇIKLAMASI</summary><p>'+escapeHTML(p.description||p.subtitle||'Ürün hakkında daha fazla bilgi eklenecek.')+'</p></details><details><summary>BAKIM VE KULLANIM</summary><p>Gerçek bakım talimatları satış başlamadan önce tamamlanacaktır.</p></details></div></div></div><section class="container section">'+sections('İLHAM VERENLER','Benzer ürünler','Tüm ürünler','#/catalog')+'<div class="product-grid">'+products.filter(x=>x.sku!==p.sku&&x.category===p.category).slice(0,4).map(card).join('')+'</div></section>';
}

function storyPage(){
  return \`<div class="journal-hero"><div class="container"><span class="eyebrow">BAKIR MUTFAK / JOURNAL 001</span><h1>Bir malzemenin<br><em>hikâyesi.</em></h1><p>Bakırın hayatımızdaki yeri, kullanım alanları ve zamansız estetiği üzerine kısa bir yolculuk.</p></div></div>
  <div class="container journal-grid"><div class="journal-aside"><span>01 — MALZEMEYİ TANIYIN</span><strong>Cu</strong><small>Bakır / Copper</small></div><div class="journal-copy"><span class="eyebrow">ZAMANSIZ BİR MALZEME</span><h2>Bakırın<br>kendine özgü dili.</h2><p>Bakır; sıcak tonları, ışığı yansıtma biçimi ve şekil verilebilir yapısıyla uzun zamandır mutfak ve dekoratif eşyalarda kullanılan bir metaldir. Ürünün nerede ve nasıl kullanılacağını değerlendirirken malzeme, iç kaplama ve üreticinin bakım bilgisini birlikte incelemek önemlidir.</p><div class="journal-rule"></div><h3>Doğru ürünü seçmek</h3><p>Bir bakır ürün yalnızca biçimiyle değil; ölçüsü, kalınlığı, yüzey işlemi ve kullanım amacına uygunluğu ile değerlendirilmelidir. Özellikle gıdayla temas eden ürünlerde kullanım talimatlarına dikkat edilmelidir.</p><a class="btn dark" href="#/catalog">Koleksiyonlara dön ↗</a></div></div>
  <section class="journal-banner"><span>BAKIR MUTFAK · THE COPPER JOURNAL</span><div class="journal-ring"></div><strong>Günlük yaşamın<br><em>küçük ritüelleri.</em></strong></section>
  <div class="container journal-note"><h2>Gerçek atölye hikâyeleri geliyor.</h2><p>Tedarikçiler ve üreticilerle ilgili doğrulanmış bilgiler geldikçe burada özgün üretim fotoğraflarına ve ustalık hikâyelerine yer vereceğiz. Şimdilik herhangi bir ürünün el yapımı olduğuna dair doğrulanmamış iddia sunmuyoruz.</p></div>\`;
}

function render(){
const parts=decodeURIComponent((location.hash||'#/').slice(2)).split('/').filter(Boolean);
const page=parts[0],item=parts[1];
$('#app').innerHTML=page==='catalog'?catalog(item):page==='product'?detail(products.find(p=>p.slug===item)):page==='story'?storyPage():home();
updateCart();window.scrollTo(0,0);
}
function changeFilters(){const list=filter();$('#catalog-grid').innerHTML=list.map(card).join('');$('#count').textContent=list.length+' ürün';$('#empty').hidden=!!list.length}
function updateCart(){
const entries=Object.entries(basket).map(([sku,qty])=>({p:products.find(x=>x.sku===sku),qty})).filter(x=>x.p&&x.qty>0);
$('#cart-count').textContent=entries.reduce((s,x)=>s+x.qty,0);
$('#cart-lines').innerHTML=entries.length?entries.map(({p,qty})=>'<div class="cart-line">'+art(p)+'<div><b>'+escapeHTML(p.name)+'</b><p>'+format(p.price)+'</p><div><button data-change="-1" data-sku="'+escapeHTML(p.sku)+'">−</button> '+qty+' <button data-change="1" data-sku="'+escapeHTML(p.sku)+'">＋</button></div></div></div>').join(''):'<p>Sepetiniz henüz boş.</p>';
$('#cart-total').textContent=format(entries.reduce((s,x)=>s+x.p.price*x.qty,0));
}
function showCart(open){$('#cart').classList.toggle('open',open);$('#shade').hidden=!open;$('#cart').setAttribute('aria-hidden',String(!open))}
function add(sku){const p=products.find(x=>x.sku===sku);if(!p||p.stock<=0)return;basket[sku]=Math.min(p.stock,(basket[sku]||0)+1);localStorage.setItem('bakirmutfak-basket',JSON.stringify(basket));updateCart();showCart(true)}
$('#app').addEventListener('click',e=>{const b=e.target.closest('[data-add]');if(b)add(b.dataset.add);if(e.target.id==='clear'){term='';inStock=false;handmade=false;tinned=false;sort='featured';render()}});
$('#app').addEventListener('input',e=>{if(e.target.id==='term'){term=e.target.value;changeFilters()}});
$('#app').addEventListener('change',e=>{if(e.target.id==='stock')inStock=e.target.checked;if(e.target.id==='handmade')handmade=e.target.checked;if(e.target.id==='tinned')tinned=e.target.checked;if(e.target.id==='sort')sort=e.target.value;changeFilters()});
$('#cart-lines').addEventListener('click',e=>{const b=e.target.closest('[data-change]');if(!b)return;const p=products.find(x=>x.sku===b.dataset.sku);if(!p)return;basket[p.sku]=Math.max(0,Math.min(p.stock,(basket[p.sku]||0)+Number(b.dataset.change)));if(!basket[p.sku])delete basket[p.sku];localStorage.setItem('bakirmutfak-basket',JSON.stringify(basket));updateCart()});
$('#cart-toggle').onclick=()=>showCart(true);$('#cart-close').onclick=()=>showCart(false);$('#shade').onclick=()=>showCart(false);
$('#menu-toggle').onclick=()=>{$('#mobile-links').hidden=!$('#mobile-links').hidden};
$('#search-toggle').onclick=()=>{$('#search-section').hidden=!$('#search-section').hidden;$('#quick-search').focus()};
$('#quick-search').addEventListener('keydown',e=>{if(e.key==='Enter'){term=e.target.value.trim();location.hash='/catalog';render();$('#search-section').hidden=true}});
window.addEventListener('hashchange',()=>{showCart(false);$('#mobile-links').hidden=true;render()});
render();
if(configured)publishedProducts().then(rows=>{products=(rows||[]).map(x=>({...x,price:Number(x.price),stock:Number(x.stock),image_urls:x.image_urls||[]}));for(const sku of Object.keys(basket)){
 const p=products.find(x=>x.sku===sku);
 if(!p||p.stock<=0)delete basket[sku];
 else basket[sku]=Math.min(p.stock,Math.max(0,Math.floor(Number(basket[sku])||0)));
}
localStorage.setItem('bakirmutfak-basket',JSON.stringify(basket));render()}).catch(e=>{$('#app').insertAdjacentHTML('afterbegin','<div class="error-banner">Ürün verileri yüklenemedi: '+escapeHTML(e.message)+'</div>')});
