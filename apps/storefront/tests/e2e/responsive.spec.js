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
   const id='test-product-'+String(i++).padStart(3,'0');
   rows.push({id,source_url:'https://bakirbul.com/urun/'+id+'/',source_host:'bakirbul.com',
    supplier_sku:'TEST-'+i,name:prefix+' '+(j+1),category:type,image_urls:[photoUrl,photoUrl]});
  }
 }
 return rows;
}
const products=catalogFixtures();
const image='<svg xmlns="http://www.w3.org/2000/svg" width="520" height="480"><rect width="520" height="480" fill="#e2c1a5"/><circle cx="255" cy="250" r="140" fill="#98593e"/></svg>';
test.beforeEach(async({page})=>{
 await page.route('https://images.pexels.com/**',route=>route.fulfill({status:200,contentType:'image/svg+xml',body:image}));
 await page.route(source+'/**',async route=>{
  const request=route.request();
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type','access-control-allow-methods':'GET,OPTIONS','content-type':'application/json'};
  if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
  const url=request.url();
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
 await page.locator('.hy-pagination a[href*="page=2"]').click();
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
 await page.goto('/#/product/catalog-test-product-000');
 await expect(page.locator('.hy-detail-layout h1')).toContainText('Klasik Bakır Cezve');
 await expect(page.locator('.hy-detail-price')).toContainText('Fiyat bilgisi hazırlanıyor');
 await expect(page.locator('.hy-gallery-thumbs button')).toHaveCount(2);
 await expect(page.locator('button')).not.toHaveText(/Satın al/);
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
