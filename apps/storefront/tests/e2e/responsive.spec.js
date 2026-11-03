import { test, expect } from '@playwright/test';
const source = 'https://hydra-e2e.supabase.co';
const photoUrl = 'https://images.pexels.com/photos/10397022/pexels-photo-10397022.jpeg';
function catalogFixtures(){
 const rows=[];
 let i=0;
 for(const [type,n,prefix] of [
  ['cezve',33,'Klasik Bakır Cezve'],
  ['caydanlik',12,'Bakır Çaydanlık'],
  ['tencere',12,'Bakır Tencere'],
  ['sofra',12,'Bakır Sunum Tepsi'],
  ['sofra',6,'Bakır Mumluk Dekor']
 ]){
  for(let j=0;j<n;j++){
   const id='11111111-1111-4111-8111-'+String(i++).padStart(12,'0');
   rows.push({id,source_url:'https://bakirbul.com/urun/'+id+'/',source_host:'bakirbul.com',
    supplier_sku:'TEST-'+i,name:prefix+' '+(j+1),category:type,image_urls:[photoUrl,photoUrl],visibility:'visible'});
  }
 }
 return rows;
}
const products=catalogFixtures();
const image='<svg xmlns="http://www.w3.org/2000/svg" width="520" height="480"><rect width="520" height="480" fill="#e2c1a5"/><circle cx="255" cy="250" r="140" fill="#98593e"/></svg>';
test.beforeEach(async({page})=>{
 let themeSettings={
   id:1,hero_title:'Bakırın en güzel seçkisi.',hero_subtitle:'Her kategoriye özel bakır ürünleri keşfedin.',
   hero_category:'cezve',featured_categories:['caydanlik','cezve','tencere','sunum','dekor']
 };
 const merchRows=new Map();
 const contentRows=new Map();
 let quoteState={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',contact_name:'Deneme Müşterisi',
   contact_email:'dummy@example.test',contact_phone:'',message:'Ürün hakkında bilgi',
   items:[{id:products[0].id,name:products[0].name,sku:products[0].supplier_sku}],
   status:'new',admin_notes:'',created_at:'2026-11-03T10:00:00.000Z'};
 await page.route('https://images.pexels.com/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:image}));
 await page.route(source+'/**',async route=>{
  const request=route.request();
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type','access-control-allow-methods':'GET,OPTIONS','content-type':'application/json'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const url=request.url();
  if(url.includes('/auth/v1/token'))return route.fulfill({status:200,headers,body:JSON.stringify({access_token:'test-token-owner',refresh_token:'test-refresh',expires_in:3600})});
  if(url.includes('/auth/v1/user'))return route.fulfill({status:200,headers,body:JSON.stringify({id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'test-admin@example.com'})});
  if(url.includes('bm_admin_users?'))return route.fulfill({status:200,headers,body:JSON.stringify([{user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',role:'owner'}])});
  if(url.includes('bm_quote_requests?')){
    if(request.method()==='PATCH')quoteState={...quoteState,...request.postDataJSON()};
    return route.fulfill({status:200,headers,body:JSON.stringify([quoteState])});
  }
  if(url.includes('bm_product_content?')){
    if(request.method()==='POST'){
      const body=request.postDataJSON()[0];contentRows.set(body.product_id,body);
      return route.fulfill({status:201,headers,body:JSON.stringify([body])});
    }
    const match=url.match(/product_id=eq[.]([0-9a-f-]{36})/i);
    let records=match?(contentRows.has(match[1])?[contentRows.get(match[1])]:[]):[...contentRows.values()];
    if(url.includes('review_status=eq.approved'))records=records.filter(x=>x.review_status==='approved');
    return route.fulfill({status:200,headers,body:JSON.stringify(records)});
  }
  if(url.includes('bm_hydra_settings?')){
   if(request.method()==='PATCH')themeSettings={...themeSettings,...request.postDataJSON()};
   return route.fulfill({status:200,headers,body:JSON.stringify([themeSettings])});
  }
  if(url.includes('bm_hydra_merchandising?')){
   if(request.method()==='POST'){
     const input=request.postDataJSON()[0];
     merchRows.set(input.product_id,input);
     return route.fulfill({status:201,headers,body:JSON.stringify([input])});
   }
   const match=url.match(/product_id=eq[.]([0-9a-f-]{36})/i);
   const items=match?(merchRows.has(match[1])?[merchRows.get(match[1])]:[]):[...merchRows.values()];
   return route.fulfill({status:200,headers,body:JSON.stringify(items)});
  }
  if(url.includes('/functions/v1/hydra-quote-request'))return route.fulfill({status:200,headers,body:JSON.stringify({ok:true,reference:'22222222-2222-4222-8222-222222222222'})});
  if(url.includes('bm_products?'))return route.fulfill({status:200,headers,body:'[]'});
  if(url.includes('bm_source_catalog?'))return route.fulfill({status:200,headers,body:JSON.stringify(products)});
  return route.fulfill({status:404,headers,body:'{"message":"Not mocked"}'});
 });
});
for(const width of [320,375,390,768,1366]){
 test('Hydra responsive storefront '+width+'px',async({page})=>{
  await page.setViewportSize({width,height:850});
  await page.goto('/');
  await expect(page.locator('.hy-hero h1')).toBeVisible();
  await expect(page.locator('.hy-category-tile')).toHaveCount(6);
  await expect(page.locator('.hy-shelf')).toHaveCount(5);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(overflow,'horizontal scroll home at '+width+'px').toBeLessThanOrEqual(width+2);
  if(width<=700){
   await page.locator('#hy-menu-toggle').click();
   await expect(page.locator('#hy-mobile-menu')).toBeVisible();
   await page.locator('#hy-mobile-menu a[href="#/catalog/cezve"]').click();
  }else{
   await page.locator('.hy-nav a[href="#/catalog/cezve"]').click();
  }
  await expect(page.locator('.hy-catalog-head h1')).toContainText('Bakır cezveler');
  await expect(page.locator('.hy-catalog-grid .hy-product')).toHaveCount(24);
  const catalogOverflow=await page.evaluate(()=>document.documentElement.scrollWidth);
  expect(catalogOverflow,'horizontal scroll catalog at '+width+'px').toBeLessThanOrEqual(width+2);
  await page.screenshot({path:'test-results/hydra-'+width+'.png',fullPage:false});
 });
}
test('Category pagination never renders 711 cards at once',async({page})=>{
 await page.goto('/#/catalog/cezve');
 await expect(page.locator('.hy-catalog-grid .hy-product')).toHaveCount(24);
 await page.getByRole('link',{name:'2',exact:true}).click();
 await expect(page.locator('.hy-catalog-grid .hy-product')).toHaveCount(9);
 await expect(page.locator('.hy-pagination-caption')).toContainText('Sayfa 2 / 2');
});
test('Search, category, favorite, and interest-list flows',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.hy-product')).not.toHaveCount(0);
 await page.locator('#hy-search-input').fill('Klasik Bakır Cezve');
 await page.locator('#hy-search-input').press('Enter');
 await expect(page.locator('.hy-search-chip')).toContainText('Klasik Bakır Cezve');
 await expect(page.locator('.hy-catalog-grid .hy-product')).toHaveCount(24);
 await page.locator('.hy-catalog-grid [data-favorite]').first().click();
 await page.locator('a[href="#/favorites"]').first().click();
 await expect(page.locator('.hy-collection-page .hy-product')).toHaveCount(1);
 await page.locator('.hy-collection-page [data-interest]').first().click();
 await page.locator('#hy-interest-trigger').click();
 await expect(page.locator('#hy-drawer')).toHaveClass(/open/);
 await expect(page.locator('.hy-drawer-item')).toHaveCount(1);
 await expect(page.locator('#hy-copy-list')).toBeEnabled();
});
test('Real catalog item shows no invented price or checkout',async({page})=>{
 await page.goto('/#/product/catalog-11111111-1111-4111-8111-000000000000');
 await expect(page.locator('.hy-detail-layout h1')).toContainText('Klasik Bakır Cezve');
 await expect(page.locator('.hy-detail-price')).toContainText('Fiyat bilgisi hazırlanıyor');
 await expect(page.locator('.hy-gallery-thumbs button')).toHaveCount(2);
 await expect(page.getByRole('button',{name:/Satın al/})).toHaveCount(0);
 await page.locator('.hy-detail-actions [data-interest]').click();
 await page.locator('#hy-interest-trigger').click();
 await expect(page.locator('.hy-drawer-item')).toHaveCount(1);
});
test('Admin remains protected by login gate',async({page})=>{
 await page.setViewportSize({width:375,height:850});
 await page.goto('/admin.html');
 await expect(page.locator('#login-form')).toBeVisible();
 await expect(page.locator('.app-shell')).toHaveCount(0);
});


test('Hydra settings drive category order and hero heading',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.hy-hero h1')).toContainText('Bakırın en güzel seçkisi.');
 await expect(page.locator('.hy-category-grid .hy-category-tile').first()).toContainText('Bakır çaydanlıklar');
 await expect(page.locator('.hy-shelf')).toHaveCount(5);
});
test('Hydra category order is identical in main catalog pills, sidebar and both navs',async({page})=>{
 await page.goto('/#/catalog/cezve');
 const expected=['all','caydanlik','cezve','tencere','sunum','dekor','sofra'];
 const pills=await page.locator('.hy-category-pills a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()));
 expect(pills).toEqual(expected);
 const sidebar=await page.locator('.hy-sidebar nav a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()));
 expect(sidebar).toEqual(expected);
 const desktop=await page.locator('.hy-nav .hy-container a[href^="#/catalog"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()).filter(id=>id!=='catalog'));
 expect(desktop).toEqual(expected.slice(1));
 const mobile=await page.locator('#hy-mobile-menu a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()).filter(id=>id!=='catalog'));
 expect(mobile).toEqual(expected.slice(1));
 await page.setViewportSize({width:390,height:850});
 await page.locator('#hy-filter-toggle').click();
 const filter=await page.locator('.hy-mobile-filter-panel a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()));
 expect(filter).toEqual(expected);
});
test('Saving a new Hydra rank immediately changes storefront order after reload',async({page})=>{
 await page.goto('/admin.html#/hydra');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await expect(page.locator('#ha-hero-form')).toBeVisible();
 await expect(page.getByText('Hydra vitrin yönetimi yükleniyor…')).toHaveCount(0);
 const current=await page.locator('.ha-order-grid [data-category-row]').evaluateAll(rows=>rows.map(x=>x.dataset.categoryRow));
 expect(current.slice(0,3)).toEqual(['caydanlik','cezve','tencere']);
 await page.locator('[data-category-order="tencere"]').selectOption('0');
 const positions=await page.locator('.ha-order-grid [data-category-row]').evaluateAll(rows=>rows.map(x=>({
  id:x.dataset.categoryRow,
  selected:x.querySelector('input[type=checkbox]').checked,
  rank:x.querySelector('select').value
 })));
 expect(positions.filter(x=>x.selected).slice(0,3).map(x=>x.id)).toEqual(['tencere','caydanlik','cezve']);
 expect(positions.filter(x=>x.selected).map(x=>x.rank)).toEqual(['0','1','2','3','4']);
 expect(positions.filter(x=>!x.selected).every(x=>x.rank===''&&x.selected===false)).toBe(true);
 await page.locator('#ha-hero-form button[type="submit"]').click();
 await expect(page.locator('#ha-alert')).toContainText('yeniden okunarak doğrulandı');
 await page.goto('/#/catalog/cezve');
 const fromPills=await page.locator('.hy-category-pills a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()));
 expect(fromPills.slice(0,4)).toEqual(['all','tencere','caydanlik','cezve']);
 const topDesktop=await page.locator('.hy-nav a[href^="#/catalog"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()).filter(id=>id!=='catalog'));
 expect(topDesktop.slice(0,3)).toEqual(['tencere','caydanlik','cezve']);
 await page.reload();
 const persistedPills=await page.locator('.hy-category-pills a').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href').split('/').pop()));
 expect(persistedPills.slice(0,4)).toEqual(['all','tencere','caydanlik','cezve']);
});
test('Smart search suggests matching products',async({page})=>{
 await page.goto('/');
 await page.locator('#hy-search-input').fill('Klasik Bakır Cezve');
 await expect(page.locator('#hy-search-suggestions')).toBeVisible();
 await expect(page.locator('#hy-search-suggestions a[href^="#/product/"]').first()).toContainText('Klasik Bakır Cezve');
});
test('Compare two products without checkout',async({page})=>{
 await page.goto('/#/catalog/cezve');
 await expect(page.locator('.hy-catalog-grid .hy-product')).toHaveCount(24);
 await page.locator('.hy-catalog-grid [data-compare]').nth(0).click();
 await page.locator('.hy-catalog-grid [data-compare]').nth(1).click();
 await expect(page.locator('#hy-compare-tray')).toBeVisible();
 await page.locator('#hy-compare-launch').click();
 await expect(page.locator('.hy-compare-table')).toBeVisible();
 await expect(page.locator('.hy-compare-table tr').first().locator('td')).toHaveCount(2);
 await expect(page.getByRole('button',{name:/Satın al/})).toHaveCount(0);
});
test('Interest list generates explicit-consent quote request',async({page})=>{
 await page.setViewportSize({width:390,height:850});
 await page.goto('/#/catalog/cezve');
 await page.locator('.hy-catalog-grid [data-interest]').first().click();
 await page.locator('#hy-interest-trigger').click();
 await page.locator('#hy-open-quote').click();
 await expect(page.locator('#hy-quote-modal')).toBeVisible();
 await page.locator('#hy-quote-form input[name="name"]').fill('Test Kullanıcı');
 await page.locator('#hy-quote-form input[name="email"]').fill('test@example.com');
 await page.locator('#hy-quote-form input[name="consent"]').check();
 await page.locator('#hy-quote-form button[type="submit"]').click();
 await expect(page.locator('#hy-quote-feedback')).toContainText('Talebiniz başarıyla kaydedildi');
 await expect(page.locator('#hy-quote-form')).toBeHidden();
});


test('Hydra Admin 2.0 owner flow controls hero and catalog without exposed credentials',async({page})=>{
 await page.setViewportSize({width:1366,height:900});
 await page.goto('/admin.html');
 await expect(page.locator('#login-form')).toBeVisible();
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await expect(page.locator('.app-shell')).toBeVisible();
 await page.locator('.sidebar [data-tab="hydra"]').click();
 await expect(page.locator('#ha-hero-form')).toBeVisible();
 await expect(page.locator('.ha-product-row')).toHaveCount(24);
 await page.locator('#ha-hero-form input[name="hero_title"]').fill('Yeni Hydra koleksiyonu başlığı');
 await page.locator('#ha-hero-form button[type="submit"]').click();
 await expect(page.locator('#ha-alert')).toContainText('Supabase’e kaydedildi ve yeniden okunarak doğrulandı');
 await page.locator('.ha-product-row').first().locator('input[name="featured"]').check();
 await page.locator('.ha-product-row').first().locator('button[type="submit"]').click();
 await expect(page.locator('#ha-alert')).toContainText('Ürün vitrin ayarı Supabase’den doğrulandı');
 await expect(page).toHaveURL(/admin[.]html#\/hydra$/);
 await page.reload();
 await expect(page.locator('#ha-hero-form')).toBeVisible();
 await expect(page.locator('#ha-hero-form input[name="hero_title"]')).toHaveValue('Yeni Hydra koleksiyonu başlığı');
 await expect(page.locator('.ha-product-row').first().locator('input[name="featured"]')).toBeChecked();
});
test('Hydra Admin 2.0 private quote inbox uses owner session',async({page})=>{
 await page.goto('/admin.html');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await expect(page.locator('.app-shell')).toBeVisible();
 await page.locator('.sidebar [data-tab="quotes"]').click();
 await expect(page.locator('.ha-quote')).toHaveCount(1);
 await expect(page.locator('.ha-quote')).toContainText('Deneme Müşterisi');
 await page.locator('.ha-quote select[name="status"]').selectOption('reviewing');
 await page.locator('.ha-quote button[type="submit"]').click();
 await expect(page.locator('.ha-quote button[type="submit"]')).toContainText('Kaydedildi');
});


test('Admin refresh keeps the current XML tab and protects original data',async({page})=>{
 await page.setViewportSize({width:390,height:850});
 await page.goto('/admin.html');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await expect(page.locator('.app-shell')).toBeVisible();
 await page.locator('.sidebar [data-tab="xml"]').click();
 await expect(page).toHaveURL(/admin[.]html#\/xml$/);
 await expect(page.locator('#feed-file')).toBeVisible();
 await page.reload();
 await expect(page.locator('#feed-file')).toBeVisible();
 await expect(page.locator('.workspace-header h1')).toContainText('XML Ürün Aktarımı');
});
test('XML inspection is read-only; two entries produce schema and catalog statistics',async({page})=>{
 await page.goto('/admin.html#/xml');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await expect(page.locator('#feed-file')).toBeVisible();
 const xml='<?xml version="1.0" encoding="utf-8"?><Urunler>'+
   '<Urun><StokKodu>SKU-101</StokKodu><UrunAdi>Bakır Cezve Bir</UrunAdi><SatisFiyati>200,50</SatisFiyati><StokAdedi>2</StokAdedi></Urun>'+
   '<Urun><StokKodu>SKU-102</StokKodu><UrunAdi>Bakır Cezve İki</UrunAdi><SatisFiyati>240,25</SatisFiyati><StokAdedi>3</StokAdedi></Urun></Urunler>';
 await page.locator('#feed-file').setInputFiles({name:'yeni-tedarikci.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 await expect(page.locator('#xml-preview')).toContainText('İçe aktarma kilitli');
 await expect(page.locator('#xml-preview')).toContainText('Mevcut katalog ile eşleşme kontrolü');
 await expect(page.locator('#xml-preview')).toContainText('Doğrulanabilir');
 await expect(page.locator('#xml-preview')).toContainText('StokKodu');
 await expect(page.locator('#xml-preview button#export-csv')).toBeEnabled();
 await expect(page.locator('#xml-preview button:disabled')).toContainText('İçe aktarma kilitli');
});
test('Unknown supplier XML schema reveals fields without accidental imports',async({page})=>{
 await page.goto('/admin.html#/xml');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 const xml='<Inventory><Entry><ProductID>A1</ProductID><Amount>99</Amount></Entry>'+
  '<Entry><ProductID>A2</ProductID><Amount>100</Amount></Entry></Inventory>';
 await page.locator('#feed-file').setInputFiles({name:'farkli.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 await expect(page.locator('#xml-preview')).toContainText('Entry');
 await expect(page.locator('#xml-preview')).toContainText('ProductID');
 await expect(page.locator('#xml-preview')).toContainText('Hiçbir kayıt değiştirilmedi');
 await expect(page.locator('#xml-preview #export-csv')).toHaveCount(0);
});
test('Hydra save does not claim success when server updates zero rows',async({page})=>{
 await page.goto('/admin.html');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await page.locator('.sidebar [data-tab="hydra"]').click();
 await expect(page.locator('#ha-hero-form')).toBeVisible();
 await page.route('https://hydra-e2e.supabase.co/rest/v1/bm_hydra_settings?**',async route=>{
  if(route.request().method()==='PATCH')return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':'application/json'},body:'[]'});
  return route.fallback();
 });
 await page.locator('#ha-hero-form input[name="hero_title"]').fill('Güncellenecek Başlık');
 await page.locator('#ha-hero-form button[type="submit"]').click();
 await expect(page.locator('#ha-alert')).toContainText('Kaydedilemedi');
 await expect(page.locator('#ha-alert')).not.toContainText('yeniden okunarak doğrulandı');
});


test('Yardımcı Bakır nested variants: parent/variant identities, VAT, duplicate SKU and stock checks',async({page})=>{
 await page.goto('/admin.html#/xml');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 const xml='<?xml version="1.0"?><Root><Urunler>'+
 '<Urun><Aktif>Evet</Aktif><UrunKartiID>10</UrunKartiID><UrunAdi>Bakır Çaydanlık Test</UrunAdi><Marka>Yardımcı Bakır</Marka><KategoriTree>Tüm Ürünler/Pişirme Ürünleri/Çaydanlıklar</KategoriTree><UrunUrl>https://yardimcibakir.com.tr/bakir-test</UrunUrl><UrunSecenek>'+
 '<Secenek><Aktif>Evet</Aktif><VaryasyonID>11</VaryasyonID><StokKodu>YBKR-TEST-ONE</StokKodu><StokAdedi>100000</StokAdedi><AlisFiyati>0.00</AlisFiyati><SatisFiyati>100.00</SatisFiyati><KDVDahil>false</KDVDahil><KdvOrani>20</KdvOrani><ParaBirimiKodu>TRY</ParaBirimiKodu></Secenek>'+
 '<Secenek><Aktif>Evet</Aktif><VaryasyonID>12</VaryasyonID><StokKodu>YBKR-TEST-ONE</StokKodu><StokAdedi>100000</StokAdedi><SatisFiyati>120.00</SatisFiyati><KDVDahil>false</KDVDahil><KdvOrani>20</KdvOrani><ParaBirimiKodu>TRY</ParaBirimiKodu></Secenek></UrunSecenek></Urun>'+
 '<Urun><Aktif>Evet</Aktif><UrunKartiID>20</UrunKartiID><UrunAdi>Bakır Cezve Test</UrunAdi><KategoriTree>Tüm Ürünler/Pişirme Ürünleri/Cezveler &amp; Sütlükler</KategoriTree><UrunUrl>https://yardimcibakir.com.tr/cezve-test</UrunUrl><UrunSecenek>'+
 '<Secenek><Aktif>Evet</Aktif><VaryasyonID>21</VaryasyonID><StokKodu>YBKR-TEST-TWO</StokKodu><StokAdedi>100000</StokAdedi><AlisFiyati>0.00</AlisFiyati><SatisFiyati>200.50</SatisFiyati><KDVDahil>false</KDVDahil><KdvOrani>20</KdvOrani><ParaBirimiKodu>TRY</ParaBirimiKodu><EkSecenekOzellik><Ozellik Tanim="RENK" Deger="Bakır">Bakır</Ozellik></EkSecenekOzellik><Resimler><Resim>https://static.ticimax.cloud/76209/Uploads/UrunResimleri/buyuk/test.jpg</Resim></Resimler></Secenek></UrunSecenek></Urun>'+
 '<Urun><Aktif>Hayır</Aktif><UrunKartiID>30</UrunKartiID><UrunAdi>Pasif Bakır Matara</UrunAdi><UrunSecenek><Secenek><Aktif>Evet</Aktif><VaryasyonID>31</VaryasyonID><StokKodu>YBKR-INACTIVE</StokKodu><StokAdedi>5</StokAdedi><SatisFiyati>300.00</SatisFiyati><KDVDahil>false</KDVDahil><KdvOrani>20</KdvOrani><ParaBirimiKodu>TRY</ParaBirimiKodu></Secenek></UrunSecenek></Urun>'+
 '</Urunler></Root>';
 await page.locator('#feed-file').setInputFiles({name:'yardimcibakir.xml',mimeType:'application/xml',buffer:Buffer.from(xml)});
 const result=page.locator('#xml-preview');
 await expect(result).toContainText('YARDIMCI BAKIR');
 await expect(result).toContainText('Tekrarlanan SKU: YBKR-TEST-ONE');
 await expect(result).toContainText('Fiyatlar %20 KDV hariçtir');
 await expect(result).toContainText('Bakır Cezve Test');
 await expect(result).toContainText('İçe aktarma kilitli');
 const items=await result.locator('.stat-card strong').allTextContents();
 expect(items).toContain('3'); // parent cards
 expect(items).toContain('4'); // total variants
 expect(items).toContain('1'); // eligible unique variant
 expect(items).toContain('2'); // duplicate SKU rows
 await expect(result.locator('#export-csv')).toBeEnabled();
 await expect(result.locator('button:disabled')).toContainText('İçe aktarma kilitli');
});
test('XML parser rejects DTD and ENTITY even in supplier template',async({page})=>{
 await page.goto('/admin.html#/xml');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await page.locator('#feed-file').setInputFiles({name:'vendor.xml',mimeType:'application/xml',
 buffer:Buffer.from('<!DOCTYPE Root [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]><Root><Urunler><Urun>&xxe;</Urun></Urunler></Root>')});
 await expect(page.locator('#xml-preview')).toContainText('DTD/ENTITY içeren XML kabul edilmez');
 await expect(page.locator('#xml-preview button#export-csv')).toHaveCount(0);
});


test('All supplier products have unique title-grounded detail copy and source reference',async({page})=>{
 await page.goto('/#/product/catalog-11111111-1111-4111-8111-000000000000');
 await expect(page.locator('.hy-detail-layout h1')).toContainText('Klasik Bakır Cezve');
 await expect(page.locator('.hy-description-body')).toContainText('Klasik Bakır Cezve 1 modelini');
 await expect(page.locator('.hy-description-body')).toContainText('Cezve seçerken');
 await expect(page.locator('.hy-content-origin').first()).toContainText('ön açıklama');
 await expect(page.locator('.hy-source-link')).toContainText('BakırBul');
 await expect(page.locator('.hy-source-link a')).toHaveAttribute('href',/bakirbul.com/);
 await expect(page.locator('.hy-detail-price')).toContainText('Fiyat bilgisi hazırlanıyor');
});
test('Admin verifies one supplier description and public product shows approved copy',async({page})=>{
 await page.goto('/admin.html#/content');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await expect(page.locator('#bm-content-list .bm-content-result')).toHaveCount(16);
 await page.locator('#bm-content-list .bm-content-result').first().click();
 await expect(page.locator('#bm-content-form')).toBeVisible();
 await expect(page.locator('.bm-content-source-link')).toHaveAttribute('href',/bakirbul.com/);
 const approved='Klasik bakır cezve modeli tedarikçi sayfasındaki ürün koduyla karşılaştırıldı. Ürün kodu TEST-1 olarak kayıtlıdır. Teknik ölçüler üretici tarafından ayrıca doğrulanmalıdır.';
 await page.locator('#bm-content-form textarea[name="description"]').fill(approved);
 await page.locator('#bm-content-form textarea[name="short_description"]').fill('Klasik bakır cezve ürün modeli.');
 await page.locator('#bm-content-form select[name="source_kind"]').selectOption('supplier_page');
 await page.locator('#bm-content-form textarea[name="specifications"]').fill('Model: Klasik cezve');
 await page.locator('#bm-content-form input[id="bm-content-confirm"]').check();
 await page.locator('#bm-content-form button[data-save-mode="approved"]').click();
 await expect(page.locator('#bm-content-notice')).toContainText('onaylandı');
 await page.goto('/#/product/catalog-11111111-1111-4111-8111-000000000000');
 await expect(page.locator('.hy-description-body')).toContainText(approved);
 await expect(page.locator('.hy-spec-list')).toContainText('Klasik cezve');
 await expect(page.locator('.hy-content-origin').first()).toContainText('yönetici onaylı');
});
test('Unapproved draft stays hidden from public product details',async({page})=>{
 await page.goto('/admin.html#/content');
 await page.locator('#login-form input[name="email"]').fill('test-admin@example.com');
 await page.locator('#login-form input[name="password"]').fill('test-only-password');
 await page.locator('#login-form button[type="submit"]').click();
 await page.locator('#bm-content-list .bm-content-result').first().click();
 await page.locator('#bm-content-form textarea[name="description"]').fill('Taslak özel metin onaylanmadan müşteriye görünmemelidir.');
 await page.locator('#bm-content-form button[data-save-mode="draft"]').click();
 await expect(page.locator('#bm-content-notice')).toContainText('taslak');
 await page.goto('/#/product/catalog-11111111-1111-4111-8111-000000000000');
 await expect(page.locator('.hy-description-body')).not.toContainText('Taslak özel metin');
 await expect(page.locator('.hy-content-origin').first()).toContainText('ön açıklama');
});
