import { productSlug, validateProduct } from './product-utils.js';

const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opts=(list,current)=>list.map(([value,label])=>'<option value="'+value+'" '+(current===value?'selected':'')+'>'+esc(label)+'</option>').join('');

export function mountProductEditor(mount, original, api) {
  const isEdit=!!original;
  const item=original||{};
  const images=Array.isArray(item.image_urls)?item.image_urls:[];
  mount.innerHTML='<section class="panel new-form" id="product-editor">'+
    '<div class="panel-head"><div><span class="eyebrow">KATALOG · '+(isEdit?'DÜZENLE':'YENİ ÜRÜN')+'</span><h2>'+(isEdit?esc(item.name):'Yeni ürün oluştur')+'</h2></div><button class="outline" id="cancel-product" type="button">Kapat ✕</button></div>'+
    '<div class="alert error" id="editor-error" hidden></div><form id="product-form">'+
    '<div class="form-grid">'+
    '<label>Ürün kodu (SKU)<input name="sku" value="'+esc(item.sku||'')+'" required maxlength="120" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,119}" '+(isEdit?'readonly':'')+' placeholder="BM-CEZ-001"></label>'+
    '<label>Ürün adı<input name="name" required minlength="2" maxlength="250" value="'+esc(item.name||'')+'"></label>'+
    '<label>Satış fiyatı (₺)<input name="price" type="number" min="0.01" max="99999999.99" step="0.01" required value="'+esc(item.price??'')+'"></label>'+
    '<label>Stok adedi<input name="stock" type="number" min="0" max="1000000" step="1" required value="'+esc(item.stock??0)+'"></label>'+
    '<label>Kategori<select name="category">'+opts([['cezve','Cezve & Kahve'],['caydanlik','Çaydanlık'],['tencere','Tencere & Sahan'],['sofra','Sofra & Sunum']],item.category||'cezve')+'</select></label>'+
    '<label>Ürün türü<select name="product_type">'+opts([['cezve','Cezve'],['caydanlik','Çaydanlık'],['tencere','Tencere'],['sahan','Sahan'],['tepsi','Tepsi'],['fincan','Fincan'],['set','Set'],['surahi','Sürahi']],item.product_type||'cezve')+'</select></label>'+
    '<label>Malzeme<input name="material" maxlength="250" value="'+esc(item.material||'')+'" placeholder="Kalaylı bakır"></label>'+
    '<label>Ölçü / kapasite<input name="size_label" maxlength="250" value="'+esc(item.size_label||'')+'" placeholder="350 ml"></label>'+
    '<label>Kısa açıklama<input name="subtitle" maxlength="250" value="'+esc(item.subtitle||'')+'"></label>'+
    '<label>Ürün rozeti<input name="badge" maxlength="250" value="'+esc(item.badge||'')+'" placeholder="YENİ"></label>'+
    '</div><label class="form-block">Ürün açıklaması<textarea name="description" rows="4" maxlength="10000" placeholder="Ürün özellikleri, kullanım ve bakım bilgileri">'+esc(item.description||'')+'</textarea></label>'+
    '<div class="form-checks"><label><input type="checkbox" name="handmade" '+(item.handmade?'checked':'')+'> El işçiliği</label><label><input type="checkbox" name="tinned" '+(item.tinned?'checked':'')+'> Kalaylı iç yüzey</label></div>'+
    '<div class="upload-panel"><h3>Ürün fotoğrafları</h3><p>JPEG, PNG veya WebP · Her fotoğraf en fazla 5 MB. Toplam en fazla 8 görsel.</p>'+
    '<label class="form-block">Bilgisayardan fotoğraf seç<input type="file" name="photo_files" accept="image/jpeg,image/png,image/webp" multiple></label>'+
    '<label class="form-block">Veya HTTPS fotoğraf bağlantıları (her satıra bir adres)<textarea name="images" rows="5" placeholder="https://ornek.com/cezve.jpg">'+esc(images.join('\n'))+'</textarea></label>'+
    '<div class="image-preview" id="image-preview">'+images.slice(0,8).filter(u=>/^https:\/\//.test(u)).map(u=>'<img loading="lazy" src="'+esc(u)+'" alt="Ürün fotoğrafı">').join('')+'</div></div>'+
    '<div class="editor-actions"><button class="primary" type="submit">'+(isEdit?'Değişiklikleri kaydet':'Taslak ürünü oluştur')+'</button><span class="hint">'+(isEdit?'Yayın durumu bu formdan değişmez.':'Yeni ürün önce taslak oluşturulur.')+'</span></div></form></section>';

  mount.querySelector('#cancel-product').onclick=()=>mount.replaceChildren();
  const form=mount.querySelector('#product-form');
  form.addEventListener('submit',async(event)=>{
    event.preventDefault();
    const submit=form.querySelector('button[type="submit"]');
    const failure=mount.querySelector('#editor-error');
    failure.hidden=true;
    let payload;
    try {
      const data=new FormData(form);
      const values=Object.fromEntries(data.entries());
      values.handmade=data.has('handmade');
      values.tinned=data.has('tinned');
      payload=validateProduct(values);
      const photos=Array.from(form.elements.photo_files.files||[]);
      if(payload.image_urls.length+photos.length>8)throw new Error('En fazla 8 görsel eklenebilir.');
      for(const photo of photos) {
        if(!['image/jpeg','image/png','image/webp'].includes(photo.type)||photo.size>5*1024*1024||!photo.size)throw new Error('Fotoğraf JPEG/PNG/WebP ve en fazla 5 MB olmalı.');
      }
      submit.disabled=true;
      submit.textContent='Fotoğraflar ve ürün kaydediliyor…';
      for(const photo of photos)payload.image_urls.push(await api.uploadProductImage(photo,payload.sku));
      if(isEdit){
        const {sku, ...changes}=payload;
        await api.updateProduct(item.id,changes);
      }else{
        payload.slug=productSlug(payload.name)+'-'+productSlug(payload.sku);
        payload.published=false;
        await api.saveProduct(payload);
      }
      await api.onSaved();
    }catch(error){
      failure.textContent='Kaydedilemedi: '+String(error.message||error);
      failure.hidden=false;
      failure.scrollIntoView({block:'nearest'});
    }finally{
      submit.disabled=false;
      submit.textContent=isEdit?'Değişiklikleri kaydet':'Taslak ürünü oluştur';
    }
  });
}
