import './admin.css';
import {configured,currentSession,login,logout,getAdmin,adminProducts,setPublished,saveProduct,updateProduct,uploadProductImage,applyXmlImport,productAudit,researchSources,addResearchSource,setResearchPermission} from './supabase.js';
import {mountProductEditor} from './product-editor.js';
import {mountHydraAdmin} from './hydra-admin.js';
import {mountQuoteInbox} from './quote-admin.js';
import {mountPhotoReview} from './photo-review.js';
import {mountBulkCatalog} from './bulk-import.js';
import {parseSupplierXml,csvFromRows} from './xml.js';

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
let user=null,products=[],audit=[],sources=[],preview=null,previewName='',tab=restoredTab();
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
return '<div class="stat-grid">'+stats.map(([title,num,ico])=>'<div class="stat-card"><div class="stat-icon">'+ico+'</div><small>'+title+'</small><strong>'+num+'</strong></div>').join('')+'</div><div class="panels"><section class="panel"><div class="panel-head"><div><span class="eyebrow">ÜRÜN YÖNETİMİ</span><h2>Son ürünler</h2></div><button data-tab="products" class="link">Tümünü gör →</button></div>'+rows(products.slice(0,6))+'</section><section class="panel narrow"><span class="eyebrow">HIZLI İŞLEMLER</span><h2>Tedarikçi bağlantısı</h2><p>XML dosyalarını yükle, fiyatları ve stokları ön izle. Hatalı kayıtları kontrol etmeden ürünleri değiştirme.</p><button class="primary" data-tab="sources">İnternetten Ürün Araştır ↗</button><button class="outline" data-tab="xml" style="margin-top:10px">XML Kontrolü</button><button class="outline" data-tab="hydra" style="margin-top:10px">Hydra Vitrin 2.0 ✦</button><button class="outline" data-tab="quotes" style="margin-top:10px">Teklif Talepleri ✉</button><div class="info-note">✓ Yönetici oturumu ve Supabase RLS açık<br>✓ Ürünler SKU ile eşleşir<br>✓ Yeni ürünler önce taslak kalır</div></section></div>';
}
function rows(items){
return '<div class="table-wrap"><table><thead><tr><th>ÜRÜN</th><th>SKU</th><th>FİYAT</th><th>STOK</th><th>DURUM</th></tr></thead><tbody>'+items.map(p=>'<tr><td><strong>'+esc(p.name)+'</strong><small>'+esc(p.category)+'</small></td><td><code>'+esc(p.sku)+'</code></td><td>'+fmt(p.price)+'</td><td>'+esc(p.stock)+'</td><td><span class="pill '+(p.published?'green':'gray')+'">'+(p.published?'Yayında':'Taslak')+'</span></td></tr>').join('')+'</tbody></table>'+(items.length?'':'<p class="empty">Henüz ürün kaydı bulunmuyor.</p>')+'</div>';
}
function productsView(){
return '<section class="panel"><div class="panel-head"><div><span class="eyebrow">KATALOG</span><h2>Ürünler ve stok</h2><p>Stok ve fiyatlar Supabase veritabanından okunur.</p></div><button class="primary" id="add-product">＋ Yeni ürün</button></div><div class="table-wrap"><table><thead><tr><th>ÜRÜN</th><th>SKU</th><th>FİYAT</th><th>STOK</th><th>YAYIN</th><th>DÜZENLE</th></tr></thead><tbody>'+products.map(p=>'<tr><td><strong>'+esc(p.name)+'</strong><small>'+esc(p.category)+'</small></td><td>'+esc(p.sku)+'</td><td>'+fmt(p.price)+'</td><td>'+esc(p.stock)+'</td><td><label class="switch"><input type="checkbox" data-publish="'+esc(p.id)+'" '+(p.published?'checked':'')+'/><span>'+(p.published?'Açık':'Kapalı')+'</span></label></td><td><button class="outline edit-button" data-edit="'+esc(p.id)+'">Düzenle ✎</button></td></tr>').join('')+'</tbody></table>'+(products.length?'':'<p class="empty">Henüz ürün yok. XML üzerinden içe aktarabilir veya yeni ürün ekleyebilirsin.</p>')+'</div></section><div id="add-product-form"></div>';
}
function xmlView(){
return '<div class="panels xml-panels"><section class="panel"><span class="eyebrow">TEDARİKÇİ XML / ADIM 01</span><h2>XML dosyanı yükle</h2><p>Ürün kodu (SKU), ad, fiyat, stok, açıklama ve görsel bağlantılarını kontrol edeceğiz. Dosya 5 MB / 500 ürün ile sınırlıdır.</p><a class="outline sample-download" href="/samples/ornek-urunler.xml" download="bakirmutfak-ornek-urunler.xml">Örnek XML indir ↓</a><p class="hint">Bu dosya sadece deneme içindir; içe aktarmak istersen örnek kayıtlar taslak oluşturulur.</p><div class="upload-zone"><div class="upload-icon">⇅</div><label for="feed-file">XML dosyası seç</label><input type="file" id="feed-file" accept=".xml,application/xml,text/xml"/><small>Dosya yalnızca bu tarayıcı oturumunda çözümlenir; onay vermeden veritabanına aktarılmaz.</small></div><div class="info-note">İçe aktarma bütün olarak doğrulanır. Tek bir hatalı SKU veya fiyat varsa aktarma kapalı kalır.</div></section><section class="panel narrow"><span class="eyebrow">GÜVENLİK KONTROLÜ</span><h2>Ürünler güvende.</h2><div class="steps"><div><b>01</b><span>XML dosyanı seç</span></div><div><b>02</b><span>Fiyat, stok ve SKU doğrulansın</span></div><div><b>03</b><span>Değişiklikleri onayla</span></div><div><b>04</b><span>Supabase sistemine güvenli aktarım</span></div></div><p>Yeni ürünler otomatik satışa açılmaz. %30 üzeri fiyat değişimlerinde ayrıca onay istenir.</p></section></div><section class="panel" id="xml-preview"><div class="panel-head"><div><span class="eyebrow">ADIM 02 / ÖN İZLEME</span><h2>Dosya seçilmedi</h2></div></div><p>XML seçildiğinde kontrol sonuçları burada görünecek.</p></section>';
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
async function onFeed(e){
const file=e.target.files?.[0];if(!file)return;
preview=null;previewName=file.name;
if(file.size>5*1024*1024){status('Dosya 5 MB sınırını aşıyor.',true);return;}
try{preview=parseSupplierXml(await file.text());showPreview()}catch(err){status(err.message,true);}
}
function showPreview(){
const p=preview;if(!p)return;
$('#xml-preview').innerHTML='<div class="panel-head"><div><span class="eyebrow">ADIM 02 / XML ÖN İZLEME</span><h2>'+esc(previewName)+'</h2></div><span class="pill '+(p.invalid?'red':'green')+'">'+(p.invalid?'Hata bulundu':'Doğrulandı')+'</span></div><div class="stat-grid compact"><div class="stat-card"><small>Okunan</small><strong>'+p.total+'</strong></div><div class="stat-card"><small>Geçerli</small><strong>'+p.valid+'</strong></div><div class="stat-card"><small>Hatalı</small><strong>'+p.invalid+'</strong></div><div class="stat-card"><small>Görselsiz</small><strong>'+p.imagesMissing+'</strong></div></div>'+(p.errors.length?'<div class="alert error">'+p.errors.slice(0,20).map(e=>'Satır '+e.line+': '+esc(e.reason)).join('<br>')+'</div>':'')+rows(p.rows.slice(0,20).map(x=>({...x,published:false})))+'<div class="preview-actions"><button id="export-csv" class="outline">CSV indir</button><button id="import-xml" class="primary" '+(p.invalid||!p.valid?'disabled':'')+'>Doğrulanan '+p.valid+' ürünü içe aktar</button></div><p class="hint">Yeni ürünler taslak kaydedilir. Mevcut SKU kayıtlarında yalnızca seçili alanlar güncellenir. %30 üstü fiyat farkı ek onay gerektirir.</p>';
$('#export-csv').onclick=()=>{const blob=new Blob(['\ufeff'+csvFromRows(p.rows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='bakirmutfak-onizleme.csv';a.click();URL.revokeObjectURL(url)};
$('#import-xml').onclick=async()=>{if(p.invalid||!p.valid)return;if(!confirm(p.valid+' ürün için Supabase ürün fiyatı ve stok güncellemesini başlatmak istiyor musun? Yeni ürünler taslak kalacak.'))return;const b=$('#import-xml');b.disabled=true;try{let res;try{res=await applyXmlImport(previewName,p.rows,false)}catch(err){if(/fiyat değişikliği|price change|%30|%30/i.test(err.message)){if(!confirm('Bazı ürünlerde %30 üzerinde fiyat değişikliği var. Buna rağmen uygulamak istiyor musunuz?'))return;res=await applyXmlImport(previewName,p.rows,true)}else throw err;}await refreshProducts();rememberTab('products',false);render();status('XML aktarımı tamamlandı: '+res.inserted+' yeni, '+res.updated+' güncellendi.')}catch(err){status('Aktarım tamamlanamadı: '+err.message,true)}finally{b.disabled=false}};
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
