import { hydraSettings, hydraMerchandising, saveHydraSettings, adminSourceCatalog, saveHydraMerchandising } from './supabase.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const options=[
 ['cezve','Bakır cezveler'],['caydanlik','Çaydanlıklar'],['tencere','Tencere & tava'],
 ['sunum','Sofra & sunum'],['dekor','Dekoratif bakır'],['sofra','Diğer bakır ürünler']
];
const initial={hero_title:'Mutfağınıza bakırın en güzel hâli.',
 hero_subtitle:'İster kahve ritüeli, ister günlük mutfak, ister özel sunum. Aradığınız bakır parçayı kategorisinde kolayca bulun.',
 hero_category:'tencere',featured_categories:options.slice(0,5).map(x=>x[0])};
export async function mountHydraAdmin(workspace){
 workspace.querySelector('#hydra-admin-root')?.remove();
 const pane=document.createElement('section');pane.id='hydra-admin-root';pane.className='hydra-admin-panel';
 pane.innerHTML='<div class="panel"><span class="eyebrow">HYDRA ADMIN 2.0 / GÖRSEL MAĞAZACILIK</span><h2>Vitrinin kontrolü sende</h2><p>Ana sayfa, kategori sıralaması ve öne çıkan ürünler tedarikçi verileri değiştirilmeden düzenlenir.</p><div role="status" class="alert" id="ha-alert" hidden></div><div id="ha-settings">Ayarlar yükleniyor…</div></div>'+
 '<section class="panel"><div class="panel-head"><div><span class="eyebrow">711+ ÜRÜN / MERCHANDISING</span><h2>Katalog görünümü</h2><p>Ürünü ara; kategorisini, vitrin konumunu veya görünürlüğünü belirle.</p></div></div><div id="ha-products">Katalog yükleniyor…</div></section>';
 workspace.querySelector('.workspace-footer')?.before(pane);
 if(!pane.isConnected)workspace.append(pane);
 const notice=(message,bad=false)=>{const el=pane.querySelector('#ha-alert');el.hidden=false;el.textContent=message;el.className='alert'+(bad?' error':'');};
 try{
  const [settings,rows,overrides]=await Promise.all([hydraSettings(),adminSourceCatalog(),hydraMerchandising()]);
  if(!pane.isConnected)return;
  const cfg={...initial,...settings},over=new Map((overrides||[]).map(x=>[x.product_id,x]));
  const ordered=options.map(([id,label])=>({id,label,enabled:cfg.featured_categories.includes(id),position:cfg.featured_categories.indexOf(id)}));
  pane.querySelector('#ha-settings').innerHTML=
    '<form id="ha-hero-form"><div class="form-grid">'+
    '<label>Başlık<input name="hero_title" maxlength="90" minlength="8" required value="'+esc(cfg.hero_title)+'"></label>'+
    '<label>Hero görsel koleksiyonu<select name="hero_category">'+
     [['all','Tüm ürünler'],...options].map(([id,label])=>'<option value="'+id+'" '+(cfg.hero_category===id?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label></div>'+
    '<label class="form-block">Ana sayfa açıklaması<textarea name="hero_subtitle" rows="3" minlength="12" maxlength="350" required>'+esc(cfg.hero_subtitle)+'</textarea></label>'+
    '<h3>Kategori vitrini ve sıralaması</h3><div class="ha-order-grid">'+ordered.map(x=>
     '<div class="ha-order-row"><label><input data-category-enabled="'+x.id+'" type="checkbox" '+(x.enabled?'checked':'')+'> '+esc(x.label)+'</label>'+
     '<label>Sıra <select data-category-order="'+x.id+'">'+Array.from({length:6},(_,i)=>'<option value="'+i+'" '+(x.position===i?'selected':'')+'>'+(i+1)+'</option>').join('')+'</select></label></div>'
    ).join('')+'</div><button class="primary" type="submit">Vitrin ayarlarını kaydet ↗</button></form>';
  pane.querySelector('#ha-hero-form').onsubmit=async event=>{
    event.preventDefault();const form=event.currentTarget;const b=form.querySelector('button[type=submit]');const fd=new FormData(form);
    const selections=options.map(([id])=>({id,enabled:!!form.querySelector('[data-category-enabled="'+id+'"]').checked,
      position:Number(form.querySelector('[data-category-order="'+id+'"]').value)}))
      .filter(x=>x.enabled).sort((a,b)=>a.position-b.position);
    if(!selections.length)return notice('En az bir kategori seçmelisin.',true);
    b.disabled=true;try{
      await saveHydraSettings({hero_title:String(fd.get('hero_title')).trim(),
       hero_subtitle:String(fd.get('hero_subtitle')).trim(),hero_category:String(fd.get('hero_category')),
       featured_categories:selections.map(x=>x.id)});
      notice('Hydra ana sayfa ayarları kaydedildi. Mağaza yenilenince görünür.');
    }catch(e){notice('Kaydedilemedi: '+e.message,true);}
    finally{b.disabled=false;}
  };
  const state={query:'',page:1,group:'all'};
  const pageSize=24;
  const productsEl=pane.querySelector('#ha-products');
  const productList=()=>{
    const q=state.query.toLocaleLowerCase('tr');
    return rows.filter(p=>{
     const group=over.get(p.id)?.display_category||p.category;
     return (state.group==='all'||state.group===group) &&
       (!q||(p.name+' '+(p.supplier_sku||'')+' '+p.source_host).toLocaleLowerCase('tr').includes(q));
    });
  };
  function render(){
    const found=productList(),pages=Math.max(1,Math.ceil(found.length/pageSize));
    state.page=Math.max(1,Math.min(pages,state.page));
    const shown=found.slice((state.page-1)*pageSize,state.page*pageSize);
    productsEl.innerHTML='<div class="ha-toolbar"><input id="ha-search" aria-label="Katalog içinde ürün ara" placeholder="Ürün adı veya SKU ile ara…" value="'+esc(state.query)+'">'+
      '<select id="ha-category" aria-label="Kategoriye göre filtrele"><option value="all">Tüm kategoriler</option>'+
      options.map(([id,label])=>'<option value="'+id+'" '+(id===state.group?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select>'+
      '<small>'+found.length+' ürün · '+state.page+'/'+pages+' sayfa</small></div>'+
      '<div class="ha-list">'+shown.map(p=>{
        const edit=over.get(p.id)||{},photo=p.image_urls?.[0]||'';
        return '<form class="ha-product-row" data-product="'+esc(p.id)+'">'+
         (photo?'<img src="'+esc(photo)+'" loading="lazy" alt="'+esc(p.name)+'">':'<div class="ha-product-placeholder">BM</div>')+
         '<div class="ha-product-identity"><strong>'+esc(p.name)+'</strong><small>'+esc(p.supplier_sku||p.id)+' · '+esc(p.source_host)+'</small></div>'+
         '<label>Kategori <select name="display_category"><option value="">Otomatik</option>'+options.map(([id,label])=>
          '<option value="'+id+'" '+(edit.display_category===id?'selected':'')+'>'+esc(label)+'</option>').join('')+'</select></label>'+
         '<label>Öne çık <input name="featured" type="checkbox" '+(edit.featured?'checked':'')+'></label>'+
         '<label>Öncelik <input name="sort_priority" type="number" min="-1000" max="1000" step="1" value="'+esc(edit.sort_priority??0)+'"></label>'+
         '<label>Vitrinde gizle <input name="hidden_from_storefront" type="checkbox" '+(edit.hidden_from_storefront?'checked':'')+'></label>'+
         '<button class="outline" type="submit">Kaydet</button></form>';
      }).join('')+'</div><div class="ha-paging"><button class="outline" id="ha-prev" '+(state.page===1?'disabled':'')+'>← Önceki</button><span>Sayfa '+state.page+' / '+pages+'</span><button class="outline" id="ha-next" '+(state.page===pages?'disabled':'')+'>Sonraki →</button></div>';
    const search=productsEl.querySelector('#ha-search');
    search.oninput=()=>{const start=search.selectionStart;state.query=search.value;state.page=1;render();const next=productsEl.querySelector('#ha-search');next.focus();next.setSelectionRange(Math.min(start,next.value.length),Math.min(start,next.value.length));};
    productsEl.querySelector('#ha-category').onchange=e=>{state.group=e.target.value;state.page=1;render();};
    productsEl.querySelector('#ha-prev').onclick=()=>{state.page--;render();};
    productsEl.querySelector('#ha-next').onclick=()=>{state.page++;render();};
    productsEl.querySelectorAll('[data-product]').forEach(form=>form.onsubmit=async e=>{
      e.preventDefault();const id=form.dataset.product,fd=new FormData(form),b=form.querySelector('button[type=submit]');
      const priority=Number(fd.get('sort_priority'));
      if(!Number.isInteger(priority)||Math.abs(priority)>1000)return notice('Öncelik -1000 ile 1000 arasında olmalı.',true);
      const update={display_category:fd.get('display_category')||null,featured:fd.has('featured'),
        hidden_from_storefront:fd.has('hidden_from_storefront'),sort_priority:priority};
      b.disabled=true;try{
        await saveHydraMerchandising(id,update);
        over.set(id,{product_id:id,...update});
        notice('Ürün vitrin ayarı kaydedildi. '+rows.find(x=>x.id===id)?.name);
      }catch(err){notice('Ürün kaydedilemedi: '+err.message,true);}
      finally{b.disabled=false;}
    });
  }
  render();
 }catch(error){pane.querySelector('#ha-settings').textContent='Hydra ayarları yüklenemedi: '+error.message;pane.querySelector('#ha-products').textContent='Yeniden giriş yapmayı deneyebilirsin.';}
}
