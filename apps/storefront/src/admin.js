import './admin.css';
import {configured,currentSession,login,logout,getAdmin,adminProducts,setPublished,saveProduct,updateProduct,uploadProductImage,applyXmlImport,productAudit} from './supabase.js';
import {mountProductEditor} from './product-editor.js';
import {parseSupplierXml,csvFromRows} from './xml.js';

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>new Intl.NumberFormat('tr-TR',{style:'currency',currency:'TRY'}).format(Number(v)||0);
let user=null,products=[],audit=[],preview=null,previewName='',tab='dashboard';
function status(message,error=false){const el=$('#status');if(el){el.textContent=message;el.className=error?'alert error':'alert';el.hidden=false;}}
function shell(content){
$('#admin-app').innerHTML='<div class="app-shell"><aside class="sidebar"><a class="mark" href="/"><span>BM✳</span><strong>BAKIR MUTFAK<small>YÖNETİM SİSTEMİ</small></strong></a><div class="subhead">ÇALIŞMA ALANI</div><button data-tab="dashboard" class="'+(tab==='dashboard'?'active':'')+'">▦ &nbsp; Genel Bakış</button><button data-tab="products" class="'+(tab==='products'?'active':'')+'">◈ &nbsp; Ürün Yönetimi</button><button data-tab="xml" class="'+(tab==='xml'?'active':'')+'">⇅ &nbsp; XML Tedarikçiler</button><button data-tab="history" class="'+(tab==='history'?'active':'')+'">◷ &nbsp; İşlem Geçmişi</button><div class="sidebar-bottom"><a href="/" target="_blank" rel="noopener">↗ Mağazaya git</a><button id="logout">Oturumu kapat</button></div></aside><main class="workspace"><header class="workspace-header"><div><span class="eyebrow">BAKIR MUTFAK · YÖNETİCİ PANELİ</span><h1>'+({dashboard:'Genel Bakış',products:'Ürün Yönetimi',xml:'XML Ürün Aktarımı',history:'Ürün İşlem Geçmişi'}[tab])+'</h1></div><div class="profile"><span class="profile-dot">✳</span><small>'+esc(user.email||'Yönetici')+'</small></div></header><div id="status" class="alert" hidden></div>'+content+'<footer class="workspace-footer">Geliştirme sürümü. Sipariş, ödeme ve otomatik XML senkronizasyonu henüz aktif değildir.</footer></main></div>';
}
function loginScreen(){
$('#admin-app').innerHTML='<div class="login-wrap"><div class="login-aside"><span>BAKIR MUTFAK / SIGNATURE</span><h2>İyi bir mağazanın<br><em>güçlü bir kalbi olur.</em></h2><p>Ürün, fiyat, stok ve XML yönetimi tek noktada.</p><div class="copper-orb"></div></div><div class="login-panel"><a class="backlink" href="/">← Mağazaya dön</a><div class="login-card"><span class="eyebrow">YÖNETİCİ GİRİŞİ</span><h1>Tekrar hoş geldin.</h1><p>Yönetim paneline erişmek için Supabase hesabınla giriş yap.</p><div id="login-error" class="alert error" hidden></div><form id="login-form"><label>E-posta adresi<input name="email" type="email" autocomplete="username" required/></label><label>Şifre<input name="password" type="password" autocomplete="current-password" required/></label><button class="primary" type="submit">Giriş yap →</button></form>'+(configured?'':'<div class="alert error">Supabase proje bağlantısı henüz yapılandırılmadı. Gerçek admin girişi açılamaz.</div>')+'<small>Yetkili yönetici hesabınla giriş yap. Yeni yönetici erişimleri mağaza sahibi tarafından tanımlanır.</small></div></div></div>';
if(!configured)$('#login-form button').disabled=true;
$('#login-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target),b=e.target.querySelector('button');b.disabled=true;b.textContent='Kontrol ediliyor...';try{user=await login(String(f.get('email')),String(f.get('password')));await refreshProducts();render()}catch(ex){$('#login-error').textContent=ex.message;$('#login-error').hidden=false}finally{b.disabled=false;b.textContent='Giriş yap →'}};
}
async function refreshProducts(){products=await adminProducts()||[]}
function dashboard(){
const published=products.filter(x=>x.published).length,stock=products.reduce((n,p)=>n+Number(p.stock||0),0);
const stats=[['Toplam ürün',products.length,'◈'],['Yayındaki ürün',published,'↗'],['Stok toplamı',stock,'▤'],['Taslak ürün',products.length-published,'○']];
return '<div class="stat-grid">'+stats.map(([title,num,ico])=>'<div class="stat-card"><div class="stat-icon">'+ico+'</div><small>'+title+'</small><strong>'+num+'</strong></div>').join('')+'</div><div class="panels"><section class="panel"><div class="panel-head"><div><span class="eyebrow">ÜRÜN YÖNETİMİ</span><h2>Son ürünler</h2></div><button data-tab="products" class="link">Tümünü gör →</button></div>'+rows(products.slice(0,6))+'</section><section class="panel narrow"><span class="eyebrow">HIZLI İŞLEMLER</span><h2>Tedarikçi bağlantısı</h2><p>XML dosyalarını yükle, fiyatları ve stokları ön izle. Hatalı kayıtları kontrol etmeden ürünleri değiştirme.</p><button class="primary" data-tab="xml">XML Kontrolüne Git ↗</button><div class="info-note">✓ Yönetici oturumu ve Supabase RLS açık<br>✓ Ürünler SKU ile eşleşir<br>✓ Yeni ürünler önce taslak kalır</div></section></div>';
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
function render(){
if(!user){loginScreen();return;}
const content=tab==='products'?productsView():tab==='xml'?xmlView():tab==='history'?historyView():dashboard();
shell(content);
$('#logout').onclick=()=>{logout();user=null;preview=null;loginScreen()};
document.querySelectorAll('[data-tab]').forEach(btn=>btn.addEventListener('click',async()=>{tab=btn.dataset.tab;if(tab==='history'){try{audit=await productAudit()}catch(e){render();status('İşlem geçmişi yüklenemedi: '+e.message,true);return}}render()}));
if(tab==='products') {
  document.querySelectorAll('[data-publish]').forEach(el=>el.onchange=async()=>{el.disabled=true;try{await setPublished(el.dataset.publish,el.checked);await refreshProducts();render();status('Yayın durumu güncellendi.')}catch(ex){el.checked=!el.checked;status(ex.message,true)}finally{el.disabled=false}});
  $('#add-product').onclick=()=>openEditor(null);
  document.querySelectorAll('[data-edit]').forEach(btn=>btn.onclick=()=>openEditor(products.find(p=>p.id===btn.dataset.edit)));
}
if(tab==='xml')$('#feed-file').onchange=onFeed;
if(tab==='history')$('#refresh-history').onclick=async()=>{try{audit=await productAudit();render()}catch(e){status(e.message,true)}};
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
$('#import-xml').onclick=async()=>{if(p.invalid||!p.valid)return;if(!confirm(p.valid+' ürün için Supabase ürün fiyatı ve stok güncellemesini başlatmak istiyor musun? Yeni ürünler taslak kalacak.'))return;const b=$('#import-xml');b.disabled=true;try{let res;try{res=await applyXmlImport(previewName,p.rows,false)}catch(err){if(/fiyat değişikliği|price change|%30|%30/i.test(err.message)){if(!confirm('Bazı ürünlerde %30 üzerinde fiyat değişikliği var. Buna rağmen uygulamak istiyor musunuz?'))return;res=await applyXmlImport(previewName,p.rows,true)}else throw err;}await refreshProducts();tab='products';render();status('XML aktarımı tamamlandı: '+res.inserted+' yeni, '+res.updated+' güncellendi.')}catch(err){status('Aktarım tamamlanamadı: '+err.message,true)}finally{b.disabled=false}};
}
async function init(){
if(!configured){loginScreen();return;}
if(currentSession())try{user=await getAdmin();if(user)await refreshProducts();}catch(e){logout();user=null;}
render();
}
init();
