import { adminQuoteRequests, updateQuoteRequest } from './supabase.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={new:'Yeni talep',reviewing:'İnceleniyor',answered:'Yanıtlandı',closed:'Kapatıldı'};
export async function mountQuoteInbox(workspace){
 workspace.querySelector('#hydra-quote-root')?.remove();
 const root=document.createElement('section');root.className='panel';root.id='hydra-quote-root';
 root.innerHTML='<div class="panel-head"><div><span class="eyebrow">HYDRA CRM · GÜVENLİ MÜŞTERİ TALEPLERİ</span><h2>Teklif ve müşteri talepleri</h2><p>Müşterinin seçtiği ürünleri, iletişim bilgilerini ve görüşme durumunu buradan takip et. Bu sayfa yalnızca yetkili yöneticilere açıktır.</p></div><button id="qr-reload" class="outline">Yenile ↻</button></div>'+
  '<div class="ha-toolbar"><label>Durum <select id="qr-filter"><option value="all">Tüm talepler</option>'+
  Object.entries(labels).map(([id,name])=>'<option value="'+id+'">'+name+'</option>').join('')+'</select></label><span id="qr-count"></span></div>'+
  '<div id="qr-list">Talepler yükleniyor…</div>';
 workspace.querySelector('.workspace-footer')?.before(root);
 if(!root.isConnected)workspace.append(root);
 let entries=[];
 const fmtDate=v=>{try{return new Date(v).toLocaleString('tr-TR')}catch{return ''}};
 const render=()=>{
  if(!root.isConnected)return;
  const filter=root.querySelector('#qr-filter').value;
  const shown=entries.filter(x=>filter==='all'||x.status===filter);
  root.querySelector('#qr-count').textContent=shown.length+' talep';
  root.querySelector('#qr-list').innerHTML=shown.length?shown.map(q=>
   '<article class="ha-quote"><div class="ha-quote-head"><div><span class="eyebrow">#'+esc(q.id.slice(0,8))+' · '+esc(fmtDate(q.created_at))+'</span>'+
   '<h3>'+esc(q.contact_name)+'</h3><a href="mailto:'+encodeURIComponent(q.contact_email)+'">'+esc(q.contact_email)+'</a>'+
   (q.contact_phone?'<small>Telefon: '+esc(q.contact_phone)+'</small>':'')+'</div>'+
   '<span class="pill '+(q.status==='new'?'green':'gray')+'">'+esc(labels[q.status]||q.status)+'</span></div>'+
   '<div class="ha-quote-products"><strong>İlgilendiği ürünler</strong><ol>'+
   (Array.isArray(q.items)?q.items:[]).map(i=>'<li>'+esc(i.name)+' <small>'+esc(i.sku||i.id)+'</small></li>').join('')+
   '</ol></div>'+(q.message?'<p class="ha-quote-message"><strong>Mesaj:</strong> '+esc(q.message)+'</p>':'')+
   '<form data-quote-id="'+esc(q.id)+'"><label>Durum <select name="status">'+
   Object.entries(labels).map(([id,name])=>'<option value="'+id+'" '+(q.status===id?'selected':'')+'>'+name+'</option>').join('')+
   '</select></label><label class="form-block">Yönetici notu<textarea name="admin_notes" rows="3" maxlength="3000" placeholder="Yalnızca yöneticiler görebilir">'+esc(q.admin_notes||'')+'</textarea></label>'+
   '<button class="primary" type="submit">Talebi güncelle</button></form></article>'
  ).join(''):'<p class="empty">Bu filtrede teklif talebi bulunmuyor.</p>';
  root.querySelectorAll('form[data-quote-id]').forEach(form=>form.onsubmit=async e=>{
   e.preventDefault();const b=form.querySelector('button'),fd=new FormData(form),q=entries.find(x=>x.id===form.dataset.quoteId);
   b.disabled=true;
   try{await updateQuoteRequest(q.id,fd.get('status'),fd.get('admin_notes'));q.status=fd.get('status');q.admin_notes=fd.get('admin_notes');b.textContent='Kaydedildi ✓';}
   catch(err){b.textContent='Hata: '+err.message;}
   finally{b.disabled=false;}
  });
 };
 const refresh=async()=>{const list=root.querySelector('#qr-list');list.textContent='Talepler yükleniyor…';
  try{entries=await adminQuoteRequests();render();}catch(e){list.textContent='Talep kutusu yüklenemedi: '+e.message;}};
 root.querySelector('#qr-filter').onchange=render;
 root.querySelector('#qr-reload').onclick=refresh;
 await refresh();
}
