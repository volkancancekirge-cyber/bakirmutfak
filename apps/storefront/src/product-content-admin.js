// Curate product descriptions from approved suppliers. Drafts are invisible to visitors.
import {adminSourceCatalog,adminCatalogContent,saveCatalogContent,previewSupplierContent} from './supabase.js';
import {fallbackProductContent,titleFacts} from './product-content.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={cezve:'Bakır cezveler',caydanlik:'Çaydanlık',tencere:'Tencere & Tava',sofra:'Sofra & Sunum'};
const verifiedUrl=u=>{try{const x=new URL(u);return x.protocol==='https:'&&['bakirbul.com','thecoppery.com'].includes(x.hostname)?x.href:null;}catch{return null;}};
export async function mountProductContentAdmin(workspace){
 workspace.querySelector('#bm-content-admin')?.remove();
 const root=document.createElement('section');root.id='bm-content-admin';root.className='bm-content-workspace';
 root.innerHTML='<section class="panel"><span class="eyebrow">HYDRA / ÜRÜN AÇIKLAMALARI</span><h2>Ürün içerik merkezi</h2>'+
 '<p>711 ürünün başlığından okunabilen ölçü, yüzey ve işçilik bilgileri müşteriye otomatik gösteriliyor. Buradan tedarikçi kaynağını kontrol edip daha ayrıntılı açıklama ekleyebilirsin. Taslak içerikler ziyaretçiye yayımlanmaz.</p>'+
 '<div id="bm-content-notice" class="alert" role="status" hidden></div>'+
 '<div class="ha-toolbar"><input id="bm-content-search" aria-label="Ürün içeriği ara" placeholder="Ürün adı veya SKU…">'+
 '<select id="bm-content-status" aria-label="İçerik durumu"><option value="all">Tüm içerikler</option><option value="missing">Henüz onaylanmamış</option><option value="draft">Taslak</option><option value="approved">Onaylı</option></select><span id="bm-content-count"></span></div>'+
 '<div class="bm-content-grid"><div><div id="bm-content-list">Ürünler yükleniyor…</div><nav class="ha-paging"><button class="outline" type="button" id="bm-content-prev">← Önceki</button><span id="bm-content-page"></span><button class="outline" type="button" id="bm-content-next">Sonraki →</button></nav></div>'+
 '<div id="bm-content-editor" class="bm-content-editor"><p class="empty">Açıklamasını hazırlamak istediğin ürünü seç.</p></div></div></section>';
 workspace.querySelector('.workspace-footer')?.before(root);
 if(!root.isConnected)workspace.append(root);
 const notice=(message,error=false)=>{const el=root.querySelector('#bm-content-notice');el.hidden=false;el.textContent=message;el.className='alert'+(error?' error':'');};
 const state={rows:[],records:new Map(),page:1,selected:null,query:'',status:'all'};
 const pageSize=16;
 try{
  const [rows,records]=await Promise.all([adminSourceCatalog(),adminCatalogContent()]);
  if(!root.isConnected)return;
  state.rows=rows.filter(x=>x.visibility==='visible'||x.visibility==='review');
  state.records=new Map(records.map(c=>[c.product_id,c]));
  renderList();
 }catch(error){notice('Ürün içerikleri yüklenemedi: '+error.message,true);root.querySelector('#bm-content-list').textContent='Ürün bilgileri okunamadı.';return;}
 function visible(){
  const q=state.query.toLocaleLowerCase('tr');
  return state.rows.filter(p=>(state.status==='all'||(state.status==='missing'&&!state.records.has(p.id))||
    state.records.get(p.id)?.review_status===state.status)&&(!q||[p.name,p.supplier_sku,p.source_host].some(t=>String(t||'').toLocaleLowerCase('tr').includes(q))));
 }
 function renderList(){
  const list=visible(),pages=Math.max(1,Math.ceil(list.length/pageSize));
  state.page=Math.min(Math.max(state.page,1),pages);
  const subset=list.slice((state.page-1)*pageSize,state.page*pageSize);
  root.querySelector('#bm-content-count').textContent=list.length+' ürün';
  root.querySelector('#bm-content-page').textContent=state.page+' / '+pages;
  root.querySelector('#bm-content-prev').disabled=state.page<=1;
  root.querySelector('#bm-content-next').disabled=state.page>=pages;
  root.querySelector('#bm-content-list').innerHTML=subset.map(p=>{
   const row=state.records.get(p.id),status=row?.review_status||'missing';
   const image=p.image_urls?.find(u=>typeof u==='string'&&u.startsWith('https://'));
   return '<button class="bm-content-result '+(state.selected===p.id?'selected':'')+'" data-content-product="'+esc(p.id)+'">'+
    (image?'<img loading="lazy" src="'+esc(image)+'" alt="">':'<span class="bm-content-no-image">BM</span>')+
    '<span class="bm-content-result-label"><strong>'+esc(p.name)+'</strong><small>'+esc(p.supplier_sku||'')+' · '+esc(p.source_host)+'</small></span>'+
    '<span class="bm-content-review">'+({approved:'Onaylı',draft:'Taslak',missing:'Ön bilgi'}[status])+'</span></button>';
  }).join('')||'<p class="empty">Bu ölçütlere uyan ürün bulunamadı.</p>';
  root.querySelectorAll('[data-content-product]').forEach(el=>el.onclick=()=>showEditor(el.dataset.contentProduct));
 }
 function showEditor(id){
  state.selected=id;renderList();
  const p=state.rows.find(x=>x.id===id),record=state.records.get(id)||null;
  if(!p)return;
  const helper=fallbackProductContent(p,p.category);
  const url=verifiedUrl(p.source_url);
  const specs=record?.specifications&&Object.keys(record.specifications).length?
    Object.entries(record.specifications).map(([key,value])=>key+': '+value).join('\n'):'';
  const editor=root.querySelector('#bm-content-editor');
  editor.innerHTML='<div class="bm-content-editor-head"><span class="eyebrow">ÜRÜN AÇIKLAMASI</span><h3>'+esc(p.name)+'</h3><small>SKU: '+esc(p.supplier_sku||'—')+'</small></div>'+
   (url?'<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer" class="outline bm-content-source-link">Ürünün tedarikçi sayfasını aç ↗</a><a href="https://www.google.com/search?q='+encodeURIComponent(p.name+' '+(p.supplier_sku||''))+'" target="_blank" rel="noopener noreferrer" class="outline bm-content-search-link">Ürün adını araştır ↗</a><button type="button" class="outline" id="bm-source-preview">Kaynak açıklamasını getir ⇣</button>':'')+
   '<details class="bm-title-facts" open><summary>Ürün başlığından okunabilen bilgiler</summary>'+
   (helper.facts.length?helper.facts.map(f=>'<span>'+esc(f.label)+': '+esc(f.value)+'</span>').join(' '):'<p>Başlıktan kesin ölçü/işçilik verisi çıkarılamadı.</p>')+
   '<p>Bu etiketler kaynak başlığından alındı; bağımsız teknik doğrulama değildir.</p></details>'+
   '<form id="bm-content-form"><label class="form-block">Kısa açıklama (isteğe bağlı)<textarea name="short_description" rows="3" maxlength="700" placeholder="Bir iki cümleyle ürünün öne çıkan, doğrulanmış özellikleri…">'+esc(record?.short_description||'')+'</textarea></label>'+
   '<label class="form-block">Ürün açıklaması<textarea name="description" rows="9" maxlength="6000" placeholder="Tedarikçi sayfasından doğruladığın ve kendi sözlerinle hazırladığın ürün bilgisi…">'+esc(record?.description||'')+'</textarea></label>'+
   '<label class="form-block">Teknik özellikler <small>(her satır: Özellik: Değer)</small><textarea name="specifications" rows="5" placeholder="Çap: 17 cm&#10;İşçilik: El dövme">'+esc(specs)+'</textarea></label>'+
   '<label class="form-block">Bilgi kaynağı<select name="source_kind">'+
   [['supplier_page','Tedarikçi web sayfası'],['supplier_document','Üretici belgesi / XML'],['manual_review','Manuel doğrulama']].map(([v,t])=>'<option value="'+v+'" '+((record?.source_kind||'manual_review')===v?'selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
   '<label class="bm-approval-check"><input type="checkbox" id="bm-content-confirm"> Bu açıklamadaki teknik iddiaları kaynakta kontrol ettim.</label>'+
   '<div class="bm-content-editor-buttons"><button class="outline" type="submit" data-save-mode="draft">Taslak kaydet</button><button class="primary" type="submit" data-save-mode="approved">Kontrol ettim, yayımla ↗</button></div>'+
   '<p class="hint">Satış fiyatı ve stok doğrulaması bundan bağımsızdır. Açıklamayı onaylamak ürünü satışa açmaz.</p></form>';
  const previewButton=editor.querySelector('#bm-source-preview');
  if(previewButton)previewButton.onclick=async()=>{
    const currentForm=editor.querySelector('#bm-content-form');
    const desc=currentForm.querySelector('textarea[name="description"]');
    if(desc.value.trim()&&!confirm('Mevcut açıklama alanı kaynak taslağı ile değişecek. Devam edilsin mi?'))return;
    previewButton.disabled=true;previewButton.textContent='Kaynak okunuyor…';
    try{
      const source=await previewSupplierContent(id);
      desc.value=source.description.slice(0,6000);
      currentForm.querySelector('textarea[name="short_description"]').value=String(source.short_description||'').slice(0,700);
      const pairs=Object.entries(source.specifications||{}).slice(0,18).filter(([key,value])=>key&&value);
      currentForm.querySelector('textarea[name="specifications"]').value=pairs.map(([key,value])=>key+': '+value).join('\n');
      currentForm.querySelector('select[name="source_kind"]').value='supplier_page';
      editor.querySelector('#bm-content-confirm').checked=false;
      notice('✓ Kaynak sayfasından açıklama taslağı getirildi. Henüz kaydedilmedi veya yayımlanmadı; metni ve teknik özellikleri doğrula.');
    }catch(e){notice('Kaynak açıklaması otomatik getirilemedi: '+e.message+' Kaynak sayfasını açıp bilgileri manuel girebilirsin.',true);}
    finally{previewButton.disabled=false;previewButton.textContent='Kaynak açıklamasını getir ⇣';}
  };
  const form=editor.querySelector('#bm-content-form');
  let mode='draft';
  form.querySelectorAll('[data-save-mode]').forEach(b=>b.addEventListener('click',()=>mode=b.dataset.saveMode));
  form.onsubmit=async e=>{
   e.preventDefault();const fd=new FormData(form);
   if(mode==='approved'&&!editor.querySelector('#bm-content-confirm').checked)return notice('Yayımlamadan önce bilgileri tedarikçi kaynağında doğruladığını onayla.',true);
   const spec={};
   for(const line of String(fd.get('specifications')||'').split(/\r?\n/)){
    if(!line.trim())continue;
    const match=line.match(/^([^:]{2,79}):\s*(.{1,159})$/);
    if(!match)return notice('Teknik özellik satırı "Özellik: Değer" biçiminde olmalı.',true);
    const key=match[1].trim(),value=match[2].trim();
    if(Object.hasOwn(spec,key))return notice('Aynı teknik özellik iki kez yazılamaz.',true);
    spec[key]=value;
   }
   const data={short_description:String(fd.get('short_description')||''),description:String(fd.get('description')||''),
    specifications:spec,source_kind:String(fd.get('source_kind')),review_status:mode};
   const b=form.querySelector('[data-save-mode="'+mode+'"]');
   b.disabled=true;
   try{const saved=await saveCatalogContent(id,data);
    state.records.set(id,saved);
    notice(mode==='approved'?'✓ Ürün açıklaması onaylandı, sunucudan doğrulandı ve mağazada yayımlanabilir.':'✓ Ürün açıklaması taslak olarak kaydedildi ve sunucudan doğrulandı.');
    renderList();
    b.textContent=mode==='approved'?'✓ Yayımlandı':'✓ Taslak kaydedildi';
   }catch(err){notice('Kaydedilemedi: '+err.message,true);b.textContent='Tekrar dene';}
   finally{b.disabled=false;}
  };
 }
 root.querySelector('#bm-content-search').oninput=e=>{state.query=e.target.value;state.page=1;renderList();};
 root.querySelector('#bm-content-status').onchange=e=>{state.status=e.target.value;state.page=1;renderList();};
 root.querySelector('#bm-content-prev').onclick=()=>{state.page--;renderList();};
 root.querySelector('#bm-content-next').onclick=()=>{state.page++;renderList();};
}
