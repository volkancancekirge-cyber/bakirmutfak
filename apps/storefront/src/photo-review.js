import { imageCandidates, previewApprovedPhotos, importApprovedPhotos, setImageCandidateReview } from './supabase.js';
const esc=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const examples=[
 {label:'BakırBul · Eylül Bakır Cezve',url:'https://bakirbul.com/urun/eylul-cezve-1-no-2-fincan-makine-dovme-kirmizi-bb1227-1/'},
 {label:'The Coppery · Klasik Çaydanlık',url:'https://thecoppery.com/tr/urun/bakirbul-klasik-caydanlik-2-no-kalin-el-dovme-kirmizi-bb1951-1'},
 {label:'The Coppery · Külhan Cezve',url:'https://thecoppery.com/tr/urun/bakirbul-kulhan-cezve-3-no-7-fincan-oyma-isleme-kirmizi-bb1235-1'}
];
function getMsg(root){return root.querySelector('#photo-feedback')}
function report(root,msg,bad=false){
 const el=getMsg(root);el.hidden=false;el.className='alert'+(bad?' error':'');el.textContent=msg;
}
function renderGallery(root,items){
 const wrap=root.querySelector('#photo-gallery');
 if(!items.length){wrap.innerHTML='<p class="empty">Henüz Supabase\'e kaydedilmiş fotoğraf adayı bulunmuyor.</p>';return;}
 wrap.innerHTML=items.map(item=>
  '<article class="photo-candidate"><div class="photo-candidate-grid">'+
    (item.image_urls||[]).map(src=>'<img src="'+esc(src)+'" alt="'+esc(item.name)+'" loading="lazy" referrerpolicy="no-referrer">').join('')+
   '</div><div class="photo-candidate-info"><span class="eyebrow">'+esc(item.source_host)+'</span><h3>'+esc(item.name)+'</h3>'+
   '<p>Kaynak SKU: '+esc(item.supplier_sku||'Belirtilmedi')+' · '+(item.image_urls?.length||0)+' görsel Supabase\'te</p>'+
   '<a href="'+esc(item.source_url)+'" target="_blank" rel="noopener noreferrer">Kaynak ürünü aç ↗</a>'+
   '<div><label>İnceleme durumu <select data-candidate-review="'+esc(item.id)+'">'+
   [['needs_review','İnceleme bekliyor'],['accepted','Görseller onaylandı'],['rejected','Reddedildi']].map(([v,label])=>'<option value="'+v+'" '+(v===item.review_status?'selected':'')+'>'+label+'</option>').join('')+
   '</select></label></div><small>Onay, ürünü satışa açmaz.</small></div></article>'
 ).join('');
 for(const select of wrap.querySelectorAll('[data-candidate-review]')){
   select.addEventListener('change',async()=>{
     const current=items.find(x=>x.id===select.dataset.candidateReview);
     select.disabled=true;
     try{await setImageCandidateReview(select.dataset.candidateReview,select.value);current.review_status=select.value;report(root,'Görsel adayı inceleme durumu kaydedildi.');}
     catch(e){select.value=current.review_status;report(root,e.message,true);}
     finally{select.disabled=false;}
   });
 }
}
function renderPreview(root,record){
 const target=root.querySelector('#photo-preview');
 target.replaceChildren();
 if(!record)return;
 const heading=document.createElement('h3');
 heading.textContent=record.name;
 target.append(heading);
 const meta=document.createElement('p');
 meta.textContent='Kaynak: '+record.source_host+' · SKU: '+(record.supplier_sku||'bulunamadı');
 target.append(meta);
 const grid=document.createElement('div');
 grid.className='photo-preview-grid';
 record.image_urls.forEach((url,index)=>{
   const label=document.createElement('label');
   label.className='photo-preview-item';
   const img=document.createElement('img');
   img.src=url;img.alt='Kaynak fotoğraf '+(index+1);img.loading='lazy';
   const checkbox=document.createElement('input');
   checkbox.type='checkbox';checkbox.value=url;checkbox.checked=index<4;
   label.append(img,checkbox,document.createTextNode(' Görsel '+(index+1)));
   grid.append(label);
 });
 target.append(grid);
 const button=document.createElement('button');
 button.type='button';button.className='primary';
 button.textContent='Seçilen fotoğrafları Supabase’e kopyala';
 target.append(button);
 const notice=document.createElement('p');
 notice.className='hint';
 notice.textContent='Kaynak sitedeki fotoğraflar önce doğrulanacak. Seçilen en fazla 4 fotoğraf taslak galeriye alınır. Mağaza ürünleri, fiyat ve stoklar değiştirilmez.';
 target.append(notice);
 button.onclick=async()=>{
   const urls=[...grid.querySelectorAll('input:checked')].map(el=>el.value);
   if(!urls.length)return report(root,'En az bir fotoğraf seçmelisin.',true);
   if(!confirm('Seçilen '+urls.length+' fotoğrafı iki onaylı kaynaktan Bakır Mutfak Supabase Storage alanına kopyalamak istiyor musun? Fotoğraflar satışa açılmaz.'))return;
   button.disabled=true;button.textContent='Fotoğraflar aktarılıyor…';
   try{
     const result=await importApprovedPhotos(record.source_url,urls);
     report(root,result.downloaded+' fotoğraf Supabase’e kopyalandı.'+(result.warnings?.length?' '+result.warnings.length+' fotoğraf aktarılamadı.':''));
     const items=await imageCandidates();
     renderGallery(root,items);
     target.replaceChildren();
   }catch(e){report(root,'Fotoğraf aktarılamadı: '+e.message,true);}
   finally{button.disabled=false;button.textContent='Seçilen fotoğrafları Supabase’e kopyala';}
 };
}
export async function mountPhotoReview(workspace){
 workspace.querySelector('#bm-photo-review')?.remove();
 const root=document.createElement('section');
 root.className='panel photo-review-panel';
 root.id='bm-photo-review';
 root.innerHTML='<div class="panel-head"><div><span class="eyebrow">ONAYLI KAYNAKLAR · GÖRSEL AKTARIMI</span><h2>İzinli ürün fotoğrafları</h2><p>BakırBul ve The Coppery ürün bağlantısından görsel bul, ön izle ve seçtiklerini Supabase’e kaydet.</p></div><span class="pill green">Yalnızca yöneticiler</span></div>'+
  '<div class="photo-source-examples">'+examples.map((item,i)=>'<button type="button" class="outline" data-example="'+i+'">'+esc(item.label)+' ↗</button>').join('')+'</div>'+
  '<form id="photo-import-form" class="photo-import-form"><label for="photo-product-url">Kaynak ürün sayfası (tam HTTPS bağlantısı)</label><div class="photo-import-row"><input id="photo-product-url" type="url" name="source_url" required placeholder="https://bakirbul.com/urun/..."><button class="primary" type="submit">Görselleri bul →</button></div></form>'+
  '<div id="photo-feedback" class="alert" hidden role="status"></div><div id="photo-preview"></div>'+
  '<div class="panel-head"><div><span class="eyebrow">SUPABASE STORAGE</span><h2>Aktarılmış görseller</h2></div><button id="photo-refresh" class="outline">Yenile ↻</button></div>'+
  '<div id="photo-gallery" class="photo-gallery"><p class="empty">Görsel adayları yükleniyor…</p></div>';
 const footer=workspace.querySelector('.workspace-footer');
 if(footer)workspace.insertBefore(root,footer); else workspace.append(root);
 async function reload(){
   try{renderGallery(root,await imageCandidates());}
   catch(e){report(root,'Görsel adayları yüklenemedi: '+e.message,true);}
 }
 root.querySelector('#photo-refresh').onclick=reload;
 root.querySelectorAll('[data-example]').forEach(btn=>btn.onclick=()=>{
   root.querySelector('#photo-product-url').value=examples[Number(btn.dataset.example)].url;
   root.querySelector('#photo-product-url').focus();
 });
 root.querySelector('#photo-import-form').onsubmit=async e=>{
   e.preventDefault();
   const form=e.currentTarget;
   const button=form.querySelector('button[type=submit]');
   const url=new FormData(form).get('source_url');
   button.disabled=true;button.textContent='Kaynak taranıyor…';
   root.querySelector('#photo-preview').replaceChildren();
   try{
     const result=await previewApprovedPhotos(url);
     if(!result.image_urls?.length)throw Error('Üründe görsel bulunamadı.');
     renderPreview(root,result);
     report(root,result.image_urls.length+' görsel adresi bulundu. Fotoğrafları inceleyip seçebilirsin.');
   }catch(err){report(root,'Ürün incelenemedi: '+err.message,true);}
   finally{button.disabled=false;button.textContent='Görselleri bul →';}
 };
 await reload();
}
