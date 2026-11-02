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
function home(){
return '<section class="hero"><div class="hero-info"><span class="eyebrow">BAKIR MUTFAK · SIGNATURE KOLEKSİYON</span><h1>Zanaatin<br><em>sıcaklığı.</em><br>Her sofrada.</h1><p>Yalnızca bakır ürünler değil, nesiller boyu devam eden bir sofra kültürü. Ustalığın izini taşıyan özel koleksiyonları keşfedin.</p><div class="hero-actions"><a class="btn dark" href="#/catalog">Koleksiyonu keşfet ↗</a><a class="underlink" href="#/story">Hikâyemiz →</a></div><span class="hero-count">01 / 03 · SIGNATURE COPPER</span></div><div class="hero-visual"><div class="hero-halo"></div>'+art({product_type:'tencere'},'hero-art')+'<div class="hero-footnote"><span>ATÖLYEDEN SOFRAYA</span><span>THE COPPER EDIT</span></div></div></section>'+
'<div class="trust"><span>✳ &nbsp; Gelenekten ilham</span><span>◇ &nbsp; Özenli seçkiler</span><span>↗ &nbsp; Kolay ürün keşfi</span></div>'+
'<section class="container section">'+sections('KOLEKSİYONLAR','Her parçanın<br>bir hikâyesi var.','Tüm ürünler','#/catalog')+'<div class="collection-grid">'+[
['cezve','01 · KAHVE','Bakır Cezveler'],['caydanlik','02 · ÇAY','Çaydanlıklar'],['tencere','03 · MUTFAK','Tencere & Sahan']
].map(([c,num,name])=>'<a class="collection collection-'+c+'" href="#/catalog/'+c+'"><span>'+num+'</span>'+art({product_type:c},'collection-art')+'<div><h3>'+name+'</h3><small>Koleksiyonu keşfet ↗</small></div></a>').join('')+'</div></section>'+
'<section class="section pale"><div class="container">'+sections('SEÇİLMİŞ ÜRÜNLER','Sofranızın<br>favorileri.','Tüm ürünler','#/catalog')+'<div class="product-grid">'+products.slice(0,4).map(card).join('')+(products.length?'':'<p>Henüz yayımlanmış ürün yok.</p>')+'</div></div></section>'+
'<section class="storyband"><div class="story-visual">'+art({product_type:'caydanlik'})+'</div><div class="story-text"><span class="eyebrow">BAKIR MUTFAK HİKÂYESİ</span><h2>Bir eşya değil.<br><em>Bir miras.</em></h2><p>Bakırın sıcaklığını modern mutfaklara taşıyan parçalar. Her çekiç izinde bir emek, her sofrada yeni bir hatıra.</p><a class="btn light" href="#/story">Hikâyemizi keşfet ↗</a></div></section>';
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
function render(){
const parts=decodeURIComponent((location.hash||'#/').slice(2)).split('/').filter(Boolean);
const page=parts[0],item=parts[1];
$('#app').innerHTML=page==='catalog'?catalog(item):page==='product'?detail(products.find(p=>p.slug===item)):page==='story'?'<section class="container section story-page"><span class="eyebrow">BAKIR MUTFAK</span><h1>Zanaatin sıcaklığı.<br>Yaşayan bir miras.</h1><p>Gerçek üretim hikâyeleri ve atölye fotoğrafları eklenecektir.</p>'+art({product_type:'caydanlik'})+'</section>':home();
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
if(configured)publishedProducts().then(rows=>{products=(rows||[]).map(x=>({...x,price:Number(x.price),stock:Number(x.stock),image_urls:x.image_urls||[]}));basket={};localStorage.removeItem('bakirmutfak-basket');render()}).catch(e=>{$('#app').insertAdjacentHTML('afterbegin','<div class="error-banner">Ürün verileri yüklenemedi: '+escapeHTML(e.message)+'</div>')});
