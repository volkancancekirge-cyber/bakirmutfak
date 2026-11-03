import './admin.css';
import {configured,currentSession,login,logout,getAdmin,adminProducts,setPublished,saveProduct,updateProduct,uploadProductImage,productAudit,researchSources,addResearchSource,setResearchPermission,adminSourceCatalog} from './supabase.js';
import {mountProductEditor} from './product-editor.js';
import {mountHydraAdmin} from './hydra-admin.js';
import {mountQuoteInbox} from './quote-admin.js';
import {mountPhotoReview} from './photo-review.js';
import {mountBulkCatalog} from './bulk-import.js';
import {parseSupplierXml,csvFromRows,inspectSupplierXml} from './xml.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(v)||0);
const ADMIN_TABS = new Set(['dashboard','products','xml','sources','hydra','quotes','history']);
const ADMIN_TAB_KEY = 'bakirmutfak.admin.active-tab';
function tabFromHash() {
  const path=decodeURIComponent((location.hash||'').replace(/^#\/?/,'')).split(/[/?]/)[0];
  return ADMIN_TABS.has(path)?path:null;
}
function restoredTab() {
  const saved=(()=>{try{return sessionStorage.getItem(ADMIN_TAB_KEY)}catch{return null}})();
  return tabFromHash()||(ADMIN_TABS.has(saved)?saved:'dashboard');
}
let user=null,products=[],audit=[],sources=[],preview=null,previewName='',previewStructure=null,previewComparison=null,previewError='',tab=restoredTab();
function rememberTab(next,addHistory=true) {
  if(!ADMIN_TABS.has(next))return;
  tab=next;
  try{sessionStorage.setItem(ADMIN_TAB_KEY,tab)}catch{}
  if(location.hash!=='#/'+tab) {
    const href=location.pathname+location.search+'#/'+tab;
    if(addHistory)history.pushState({adminTab:tab},'',href);
    else history.replaceState({adminTab:tab},'',href);
  }
}
async function goToTab(next,addHistory=true) {
  if(!ADMIN_TABS.has(next))return;
  rememberTab(next,addHistory);
  if(!user)return;
  if(next==='history'){
    try{audit=await productAudit()}catch(e){render();status('İşlem geçmişi yüklenemedi: '+e.message,true);return}
  }
  if(next==='sources'){
    try{sources=await researchSources()}catch(e){render();status('Kaynak listesi yüklenemedi: '+e.message,true);return}
  }
  if(tab===next)render();
}
function restoreHistoryTab() {
  const next=tabFromHash()||restoredTab();
  if(next!==tab)goToTab(next,false);
}
window.addEventListener('popstate',restoreHistoryTab);
window.addEventListener('hashchange',restoreHistoryTab);
function status(message,error=false){const el=$('#status');if(el){el.textContent=message;el.className=error?'alert error':'alert';el.hidden=false;}}
function shell(content){
$('#admin-app').innerHTML='<div class="app-shell"><aside class="sidebar"><a class="mark" href="/"><span>BM✳</span><strong>BAKIR MUTFAK<small>YÖNETİM SİSTEMİ</small></strong></a><div class="subhead">ÇALIŞMA ALANI</div><button data-tab="dashboard" class="'+(tab==='dashboard'?'active':'')+'">▦ &nbsp; Genel Bakış</button><button data-tab="products" class="'+(tab==='products'?'active':'')+'">◈ &nbsp; Ürün Yönetimi</button><button data-tab="xml" class="'+(tab==='xml'?'active':'')+'">⇅ &nbsp; XML Tedarikçiler</button><button data-tab="sources" class="'+(tab==='sources'?'active':'')+'">⌕ &nbsp; İnternetten Ürün Araştır</button><button data-tab="hydra" class="'+(tab==='hydra'?'active':'')+'">✦ &nbsp; Hydra Vitrin</button><button data-tab="quotes" class="'+(tab==='quotes'?'active':'')+'">✉ &nbsp; Teklif Talepleri</button><button data-tab="history" class="'+(tab==='history'?'active':'')+'">◷ &nbsp; İşlem Geçmişi</button><div class="sidebar-bottom"><a href="/" target="_blank" rel="noopener">↗ Mağazaya git</a><button id="logout">Oturumu kapat</button></div></aside><main class="workspace"><header class="workspace-header"><div><span class="eyebrow">BAKIR MUTFAK · YÖNETİCİ PANELİ</span><h1>'+({dashboard:'Genel Bakış',products:'Ürün Yönetimi',xml:'XML Ürün Aktarımı',history:'Ürün İşlem Geçmişi',sources:'Ürün Kaynak Araştırması',hydra:'Hydra Vitrin Yönetimi',quotes:'Müşteri Teklif Talepleri'}[tab])+'</h1></div><div class="profile"><span class="profile-dot">✳</span><small>'+esc(user.email||'Yönetici')+'</small></div></header><div id="status" class="alert" hidden></div>'+content+'<footer class="workspace-footer">Geliştirme sürümü. Sipariş, ödeme ve otomatik XML senkronizasyonu henüz aktif değildir.</footer></main></div>';
}
function loginScreen(){
$('#admin-app').innerHTML='<div class="login-wrap"><div class="login-aside"><span>BAKIR MUTFAK / SIGNATURE</span><h2>İyi bir mağazanın<br><em>güçlü bir kalbi olur.</em></h2><p>Ürün, fiyat, stok ve XML yönetimi tek noktada.</p><div class="copper-orb"></div></div><div class="login-panel"><a class="backlink" href="/">← Mağazaya dön</a><div class="login-card"><span class="eyebrow">YÖNETİCİ GİRİŞİ</span><h1>Tekrar hoş geldin.</h1><p>Yönetim paneline erişmek için Supabase hesabınla giriş yap.</p><div id="login-error" class="alert error" hidden></div><form id="login-form"><label>E-posta adresi<input name="email" type="email" autocomplete="username" required/></label><label>Şifre<input name="password" type="password" autocomplete="current-password" required/></label><button class="primary" type="submit">Giriş yap →</button></form>'+(configured?'':'<div class="alert error">Supabase proje bağlantısı henüz yapılandırılmadı. Gerçek admin girişi açılamaz.</div>')+'<small>Yetkili yönetici hesabınla giriş yap. Yeni yönetici erişimleri mağaza sahibi tarafından tanımlanır.</small></div></div></div>';
if(!configured)$('#login-form button').disabled=true;
$('#login-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),b=e.target.querySelector('button');b.disabled=true;b.textContent='Kontrol ediliyor...';try{user=await login(String(f.get('email')),String(f.get('password')));await refreshProducts();render()}catch(ex){$('#login-error').textContent=ex.message;$('#login-error').hidden=false}finally{b.disabled=false;b.textContent='Giriş yap →'}};
}
async function refreshProducts(){products=await adminProducts()||[]}
function dashboard(){
const published=products.filter(x=>x.published).length,stock=products.reduce((n,p)=>n+Number(p.stock||0),0);
const stats=[['Elle yönetilen ürün',products.length,'◈'],['Yayındaki manuel ürün',published,'↗'],['Manuel stok toplamı',stock,'▤'],['Manuel taslak',products.length-published,'○']];
return '<div class="stat-grid">'+stats.map(([title,num,ico])=>'<div class="stat-card"><div class="stat-icon">'+ico+'</div><small>'+title+'</small><strong>'+num+'</strong></div>').join('')+'</div><div class="panels"><section class="panel"><div class="panel-head"><div><span class="eyebrow">ÜRÜN YÖNETİMİ</span><h2>Son ürünler</h2></div><button data-tab="products" class="link">Tümünü gör →</button></div>'+rows(products.slice(0,6))+'</section><section class="panel narrow"><span class="eyebrow">HIZLI İŞLEMLER</span><h2>Tedarikçi bağlantısı</h2><p>XML dosyasını güvenli ön izlemeye al; mevcut katalogla eşleşme ve kritik fiyat/stok farklarını kontrol et. Henüz ürünleri değiştirme.</p><button class="primary" data-tab="sources">İnternetten Ürün Araştır ↗</button><button class="outline" data-tab="xml" style="margin-top:10px">XML Kontrolü</button><button class="outline" data-tab="hydra" style="margin-top:10px">Hydra Vitrin 2.0 ✦</button><button class="outline" data-tab="quotes" style="margin-top:10px">Teklif Talepleri ✉</button><div class="info-note">✓ Yönetici oturumu ve Supabase RLS açık<br>✓ Ürünler SKU ile eşleşir<br>✓ Yeni ürünler önce taslak kalır</div></section></div>';
}
function rows(items){
return '<div class="table-wrap"><table><thead><tr><th>ÜRÜN</th><th>SKU</th><th>FİYAT</th><th>STOK</th><th>DURUM</th></tr></thead><tbody>'+items.map(p=>'<tr><td><strong>'+esc(p.name)+'</strong><small>'+esc(p.category)+'</small></td><td><code>'+esc(p.sku)+'</code></td><td>'+fmt(p.price)+'</td><td>'+esc(p.stock)+'</td><td><span class="pill '+(p.published?'green':'gray')+'">'+(p.published?'Yayında':'Taslak')+'</span></td></tr>').join('')+'</tbody></table>'+(items.length?'':'<p class="empty">Henüz ürün kaydı bulunmuyor.</p>')+'</div>';
}
function productsView(){
return '<section class="panel"><div class="panel-head"><div><span class="eyebrow">KATALOG</span><h2>Ürünler ve stok</h2><p>Stok ve fiyatlar Supabase veritabanından okunur.</p></div><button class="primary" id="add-product">＋ Yeni ürün</button></div><div class="table-wrap"><table><thead><tr><th>ÜRÜN</th><th>SKU</th><th>FİYAT</th><th>STOK</th><th>YAYIN</th><th>DÜZENLE</th></tr></thead><tbody>'+products.map(p=>'<tr><td><strong>'+esc(p.name)+'</strong><small>'+esc(p.category)+'</small></td><td>'+esc(p.sku)+'</td><td>'+fmt(p.price)+'</td><td>'+esc(p.stock)+'</td><td><label class="switch"><input type="checkbox" data-publish="'+esc(p.id)+'" '+(p.published?'checked':'')+'/><span>'+(p.published?'Açık':'Kapalı')+'</span></label></td><td><button class="outline edit-button" data-edit="'+esc(p.id)+'">Düzenle ✎</button></td></tr>').join('')+'</tbody></table>'+(products.length?'':'<p class="empty">Henüz ürün yok. XML üzerinden içe aktarabilir veya yeni ürün ekleyebilirsin.</p>')+'</div></section><div id="add-product-form"></div>';
}
function xmlView(){
return '<div class="panels xml-panels"><section class="panel"><span class="eyebrow">TEDARİKÇİ XML / ADIM 01</span><h2>XML dosyanı yükle</h2><p>Ürün kodu (SKU), ad, fiyat, stok, açıklama ve görsel bağlantılarını kontrol edeceğiz. Ön izleme 15 MB / 5.000 ürün destekler. Gerçek tedarikçi alanları ve mevcut 711 ürünle eşleşme kontrol edilir.</p><a class="outline sample-download" href="/samples/ornek-urunler.xml" download="bakirmutfak-ornek-urunler.xml">Örnek XML indir ↓</a><p class="hint">Bu dosya sadece deneme içindir; içe aktarmak istersen örnek kayıtlar taslak oluşturulur.</p><div class="upload-zone"><div class="upload-icon">⇅</div><label for="feed-file">XML dosyası seç</label><input type="file" id="feed-file" accept=".xml,application/xml,text/xml"/><small>Dosya tarayıcında analiz edilir; veritabanına yüklenmez. XML içe aktarma, kaynak şema doğrulaması tamamlanıncaya kadar kapalı.</small></div><div class="info-note">İçe aktarma şimdilik devre dışı. Önce ürün kodu, fiyat/stok alanı, mükerrer kayıt ve mevcut katalogla eşleşme doğrulanır; hiçbir ürün otomatik yayımlanmaz.</div></section><section class="panel narrow"><span class="eyebrow">GÜVENLİK KONTROLÜ</span><h2>Ürünler güvende.</h2><div class="steps"><div><b>01</b><span>XML dosyanı seç</span></div><div><b>02</b><span>Fiyat, stok ve SKU doğrulansın</span></div><div><b>03</b><span>Değişiklikleri onayla</span></div><div><b>04</b><span>Supabase sistemine güvenli aktarım</span></div></div><p>Yeni ürünler otomatik satışa açılmaz. %30 üzeri fiyat değişimlerinde ayrıca onay istenir.</p></section></div><section class="panel" id="xml-preview"><div class="panel-head"><div><span class="eyebrow">ADIM 02 / ÖN İZLEME</span><h2>Dosya seçilmedi</h2></div></div><p>XML seçildiğinde kontrol sonuçları burada görünecek.</p></section>';
}
function historyView(){
 const fmtState=(state)=>{
   if(!state)return '—';
   return 'Fiyat: '+fmt(state.price)+' · Stok: '+esc(state.stock)+' · '+(state.published?'Yayında':'Taslak')+' · Görsel: '+esc(state.images||0);
 };
 return '<section class="panel"><div class="panel-head"><div><span class="eyebrow">GÜVENLİK VE DENETİM</span><h2>Ürün değişiklik geçmişi</h2><p>Ürün oluşturma, fiyat, stok, yayın durumu ve görsel değişiklikleri otomatik kaydedilir. Kayıtları yalnızca yetkili yöneticiler okuyabilir.</p></div><button class="outline" id="refresh-history">Yenile ↻</button></div><div class="table-wrap"><table><thead><tr><th>TARİH</th><th>ÜRÜN KODU</th><th>İŞLEM</th><th>ÖNCE</th><th>SONRA</th></tr></thead><tbody>'+audit.map(x=>'<tr><td>'+esc(new Date(x.created_at).toLocaleString('tr-TR'))+'</td><td><code>'+esc(x.sku)+'</code></td><td><span class="pill '+(x.action==='created'?'green':'gray')+'">'+esc(({created:'Oluşturuldu',updated:'Güncellendi',deleted:'Silindi'})[x.action]||x.action)+'</span></td><td>'+fmtState(x.before_state)+'</td><td>'+fmtState(x.after_state)+'</td></tr>').join('')+'</tbody></table>'+(audit.length?'':'<p class="empty">Henüz kaydedilmiş ürün değişikliği bulunmuyor. Bu özellik kurulduktan sonraki değişiklikleri kaydeder.</p>')+'</div></section>';
}

const permissionLabel = {
  permission_needed:'İzin bekleniyor',
  approved:'Kaynak izni onaylandı',
  rejected:'Uygun değil'
};
function sourceView(){
  return '<div class="source-intro"><div><span class="eyebrow">ÜRÜN ARAŞTIRMA MERKEZİ / BETA</span><h2>XML beklemeden<br><em>kaynakları keşfet.</em></h2><p>İnternetteki üretici ve toptan satıcıları burada değerlendir. Katalog bilgisi ve görselleri kullanmak için sağlayıcının iznini aldıktan sonra otomatik veri aktarımını açacağız.</p></div><div class="source-count"><strong>'+sources.length+'</strong><small>İNCELENEN KAYNAK</small></div></div>'+
  '<div class="panels source-panels"><section class="panel"><span class="eyebrow">ARAŞTIRILAN KAYNAKLAR</span><h2>Tedarikçi adayları</h2><div class="sources-list">'+sources.map(x=>
    '<article class="source-item"><div class="source-main"><div><h3>'+esc(x.source_name)+'</h3><small>'+esc(x.source_host)+'</small></div><span class="pill '+(x.rights_status==='approved'?'green':x.rights_status==='rejected'?'red':'gray')+'">'+esc(permissionLabel[x.rights_status]||'İzin bekleniyor')+'</span></div><p>'+esc(x.notes||'Ön değerlendirme için eklendi.')+'</p><div class="source-actions"><a class="outline" href="'+esc(x.source_url)+'" target="_blank" rel="noopener noreferrer">Kaynağı incele ↗</a><select data-permission="'+esc(x.id)+'" aria-label="'+esc(x.source_name)+' için kullanım izni durumu"><option value="permission_needed" '+(x.rights_status==='permission_needed'?'selected':'')+'>İzin bekleniyor</option><option value="approved" '+(x.rights_status==='approved'?'selected':'')+'>İzin alındı</option><option value="rejected" '+(x.rights_status==='rejected'?'selected':'')+'>Uygun değil</option></select></div></article>').join('')+'</div></section>'+
  '<section class="panel narrow"><span class="eyebrow">YENİ KAYNAK EKLE</span><h2>Ürün kaynağı araştır</h2><p>Üretici, tedarikçi veya toptancı adresini ekle. Bu işlem ürün, görsel, fiyat veya stok kopyalamaz.</p><form id="source-form"><label class="form-block">Kaynak adı<input name="source_name" required minlength="2" maxlength="120" placeholder="Örn. Bakır Üretim Atölyesi"></label><label class="form-block">HTTPS adresi<input name="source_url" type="url" required placeholder="https://tedarikci.com/"></label><label class="form-block">Kategori<select name="category"><option value="genel">Genel</option><option value="cezve">Cezve</option><option value="caydanlik">Çaydanlık</option><option value="tencere">Tencere</option><option value="sofra">Sofra</option></select></label><button type="submit" class="primary">Araştırmaya ekle ↗</button></form><div class="info-note">Kaynak adresleri yalnızca yönetim panelinde görünür. Ürünlerin marka, fotoğraf, açıklama ve stok bilgileri otomatik olarak Bakır Mutfak envanterine dönüşmez.</div></section></div>';
}
function attachSourceActions(){
  const form=$('#source-form');
  form.onsubmit=async e=>{
    e.preventDefault();const fd=new FormData(form);const b=form.querySelector('button');
    b.disabled=true;try{
      await addResearchSource(fd.get('source_name'),fd.get('source_url'),fd.get('category'));
      sources=await researchSources();render();status('Kaynak araştırma listesine eklendi; hiçbir ürün yayımlanmadı.');
    }catch(err){status('Kaynak eklenemedi: '+err.message,true)}finally{b.disabled=false}
  };
  document.querySelectorAll('[data-permission]').forEach(select=>select.onchange=async()=>{
    const id=select.dataset.permission;
    const previous=sources.find(x=>x.id===id)?.rights_status||'permission_needed';
    const next=select.value;
    if(next==='approved'&&!confirm('Bu tedarikçiden ürün bilgilerini ve fotoğrafları ticari amaçla kullanmak için açık izin aldığını doğruluyor musun? Bu işaretleme ürün aktarımını başlatmaz.')){
      select.value=previous;return;
    }
    select.disabled=true;try{
      await setResearchPermission(id,next);sources=await researchSources();render();status('Kaynak değerlendirme durumu güncellendi.');
    }catch(err){select.value=previous;status(err.message,true)}finally{select.disabled=false}
  });
}

function render(){
if(!user){loginScreen();return;}
const content=tab==='products'?productsView():tab==='xml'?xmlView():tab==='history'?historyView():tab==='sources'?sourceView():tab==='hydra'?'<section class="panel"><h2>Hydra vitrin yönetimi yükleniyor…</h2></section>':tab==='quotes'?'<section class="panel"><h2>Müşteri talepleri yükleniyor…</h2></section>':dashboard();
shell(content);
$('#logout').onclick=()=>{logout();user=null;preview=null;rememberTab('dashboard',false);loginScreen()};
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>goToTab(btn.dataset.tab)));
if(tab==='products') {
  document.querySelectorAll('[data-publish]').forEach(el=>el.onchange=async()=>{el.disabled=true;try{await setPublished(el.dataset.publish,el.checked);await refreshProducts();render();status('Yayın durumu güncellendi.')}catch(ex){el.checked=!el.checked;status(ex.message,true)}finally{el.disabled=false}});
  $('#add-product').onclick=()=>openEditor(null);
  document.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>openEditor(products.find(p=>p.id===btn.dataset.edit)));
}
if(tab==='xml')$('#feed-file').onchange=onFeed;
if(tab==='history')$('#refresh-history').onclick=async()=>{try{audit=await productAudit();render()}catch(e){status(e.message,true)}};
if(tab==='sources') { attachSourceActions(); const workspace=document.querySelector('.workspace'); mountBulkCatalog(workspace).catch(err=>status('Toplu aktarım ekranı hazırlanamadı: '+err.message,true)); mountPhotoReview(workspace).catch(err=>status('Görsel paneli hazırlanamadı: '+err.message,true)); }
if(tab==='hydra')mountHydraAdmin(document.querySelector('.workspace')).catch(e=>status('Hydra vitrin paneli hatası: '+e.message,true));
if(tab==='quotes')mountQuoteInbox(document.querySelector('.workspace')).catch(e=>status('Teklif paneli hatası: '+e.message,true));
}
function openEditor(product) {
  const el=$('#add-product-form');
  if(!el)return;
  mountProductEditor(el,product,{
    saveProduct,updateProduct,uploadProductImage,
    onSaved:async()=>{
      await refreshProducts();
      render();
      status(product?'Ürün başarıyla güncellendi.':'Yeni ürün taslak olarak kaydedildi.');
    }
  });
  el.scrollIntoView({behavior:'smooth',block:'start'});
}

async function onFeed(e) {
 const file=e.target.files?.[0];if(!file)return;
 preview=null;previewName=file.name;previewStructure=null;previewComparison=null;previewError='';
 if(file.size>15*1024*1024){status('XML 15 MB ön izleme sınırını aşıyor. Dosyayı sohbetimize yükleyebilirsin; büyük tedarikçi XML dosyaları için sunucu analizi gerekiyor.',true);return;}
 if(!file.name.toLowerCase().endsWith('.xml')){status('Lütfen .xml uzantılı tedarikçi dosyası seç.',true);return;}
 try{
  const data=await file.text();
  previewStructure=inspectSupplierXml(data);
  try{preview=parseSupplierXml(data);}
  catch(err){previewError=err.message;status('XML alanları mevcut şemayla tam eşleşmedi: '+previewError,true);}
  if(preview){
   try{
    const sourceRows=await adminSourceCatalog();
    const normalized=value=>String(value||'').normalize('NFKC').trim().toLocaleLowerCase('tr');
    const sourceSku=new Set(sourceRows.filter(x=>x.supplier_sku).map(x=>normalized(x.supplier_sku)));
    const sourceName=new Set(sourceRows.map(x=>normalized(x.name)));
    const manualSku=new Map(products.map(x=>[normalized(x.sku),x]));
    let bySku=0,byName=0,manual=0,priceAlerts=0,unmatched=0;
    for(const row of preview.rows){
      const sku=normalized(row.sku);
      if(sourceSku.has(sku))bySku++;
      else if(sourceName.has(normalized(row.name)))byName++;
      else unmatched++;
      const old=manualSku.get(sku);
      if(old){manual++;if(Number(old.price)>0&&Math.abs(row.price-Number(old.price))>Number(old.price)*0.3)priceAlerts++;}
    }
    previewComparison={bySku,byName,manual,priceAlerts,unmatched};
   }catch(error){
    previewError='Mevcut katalogla eşleştirme yapılamadı: '+error.message;
    status(previewError,true);
   }
  }
  showPreview();
 }catch(err){previewError=err.message;status('XML incelenemedi: '+err.message,true);showPreview();}
}
function showPreview() {
 const mount=$('#xml-preview');if(!mount)return;
 const schema=previewStructure;
 const report=preview;
 const alerts=[];
 if(previewError)alerts.push('<div class="alert error">'+esc(previewError)+'</div>');
 let markup='<div class="panel-head"><div><span class="eyebrow">ADIM 02 / YALNIZCA ÖN İZLEME</span><h2>'+esc(previewName||'XML')+'</h2></div><span class="pill gray">İçe aktarma kilitli</span></div>';
 markup+='<div class="info-note"><strong>GÜVENLİ İNCELEME MODU:</strong> Bu işlem hiçbir ürünü, stoğu veya fiyatı değiştirmez. XML üretici eşleştirmesi ve testleri tamamlanmadan aktarım başlatılmayacak.</div>';
 if(schema){
  markup+='<div class="stat-grid compact"><div class="stat-card"><small>Kök etiket</small><strong class="xml-schema-root">'+esc(schema.root)+'</strong></div>'+
   '<div class="stat-card"><small>XML etiket sayısı</small><strong>'+schema.elementCount+'</strong></div>'+
   '<div class="stat-card"><small>Olası ürün etiketi</small><strong class="xml-schema-root">'+esc(schema.likelyRow?.tag||'—')+'</strong></div>'+
   '<div class="stat-card"><small>Olası ürün adedi</small><strong>'+esc(schema.likelyRow?.count||0)+'</strong></div></div>';
  markup+='<details class="xml-fields" open><summary>Algılanan XML alanları</summary><div class="xml-field-chips">'+
   schema.fields.slice(0,30).map(x=>'<code>'+esc(x)+'</code>').join('')+
   '</div>'+(schema.rowCandidates.length>1?'<p class="hint">Diğer tekrar eden etiketler: '+schema.rowCandidates.slice(1,5).map(x=>esc(x.tag)+' ('+x.count+')').join(' · ')+'</p>':'')+'</details>';
 }
 markup+=alerts.join('');
 if(report){
  markup+='<div class="stat-grid compact"><div class="stat-card"><small>Toplam ürün</small><strong>'+report.total+'</strong></div>'+
   '<div class="stat-card"><small>Doğrulanabilir</small><strong>'+report.valid+'</strong></div>'+
   '<div class="stat-card"><small>Hatalı satır</small><strong>'+report.invalid+'</strong></div>'+
   '<div class="stat-card"><small>Fotoğrafsız</small><strong>'+report.imagesMissing+'</strong></div></div>';
  if(report.invalid)markup+='<div class="alert error">'+report.errors.slice(0,30).map(e=>'Ürün '+e.line+': '+esc(e.reason)).join('<br>')+'</div>';
  if(previewComparison){
   const c=previewComparison;
   markup+='<h3>Mevcut katalog ile eşleşme kontrolü</h3><div class="stat-grid compact">'+
   '<div class="stat-card"><small>Kaynak SKU eşleşmesi</small><strong>'+c.bySku+'</strong></div>'+
   '<div class="stat-card"><small>İsim benzerliği (kontrol)</small><strong>'+c.byName+'</strong></div>'+
   '<div class="stat-card"><small>Farklı / yeni aday</small><strong>'+c.unmatched+'</strong></div>'+
   '<div class="stat-card"><small>Eski manuel SKU</small><strong>'+c.manual+'</strong></div></div>'+
   (c.priceAlerts?'<div class="alert error">'+c.priceAlerts+' mevcut manuel üründe %30 üzeri fiyat farkı tespit edildi; ayrıca değerlendirme gerekir.</div>':'');
  }
  markup+='<h3>Örnek ürünler (ilk 20)</h3>'+rows(report.rows.slice(0,20).map(x=>({...x,published:false})))+
   '<div class="preview-actions"><button id="export-csv" class="outline">CSV ön izlemeyi indir</button><button type="button" disabled class="primary">İçe aktarma kilitli · XML eşleştirmesi bekleniyor</button></div>'+
   '<p class="hint">İlk aşamada hiçbir satış ürünü otomatik yayımlanmayacak. Mevcut 711 ürünle farklı kod/aynı isim tespitleri ayrıca gözden geçirilmeli. Sunucu aktarımı en fazla 500 ürünlük partiler desteklediğinden, büyük XML için işlem planı yapılmalı.</p>';
 }else markup+='<p>Ürün verileri genel XML şemasından çözümlenemedi. Yukarıdaki etiket adlarıyla gerçek tedarikçiye özel alan eşleştirmesi hazırlanmalı. <strong>Hiçbir kayıt değiştirilmedi.</strong></p>';
 mount.innerHTML=markup;
 const csv=$('#export-csv');
 if(csv)csv.onclick=()=>{
   const blob=new Blob(['\ufeff'+csvFromRows(report.rows)],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');a.href=url;a.download='bakirmutfak-xml-onizleme.csv';a.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
 };
}

async function init(){
if(!configured){loginScreen();return;}
if(currentSession())try{user=await getAdmin();if(user)await refreshProducts();}catch(e){logout();user=null;}
rememberTab(tab,false);
if(user&&tab==='history')try{audit=await productAudit()}catch(e){console.warn('İşlem geçmişi açılamadı:',e.message)}
if(user&&tab==='sources')try{sources=await researchSources()}catch(e){console.warn('Kaynak listesi açılamadı:',e.message)}
render();
}
init();
