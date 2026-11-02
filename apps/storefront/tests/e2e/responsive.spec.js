import { test, expect } from '@playwright/test';
const sizes=[320,375,390,768,1366];
for(const width of sizes){
 test('responsive home + navigation at '+width+'px', async ({page})=>{
   await page.setViewportSize({width,height:850});
   await page.goto('/');
   await expect(page.locator('.signature-hero h1')).toBeVisible();
   await expect(page.locator('.discovery-card')).toHaveCount(4);
   const overflow=await page.evaluate(()=>({view:innerWidth,scroll:document.documentElement.scrollWidth}));
   expect(overflow.scroll,'horizontal overflow on home at '+width+'px').toBeLessThanOrEqual(width+2);
   if(width<=768){
     await page.locator('#menu-toggle').click();
     await expect(page.locator('#mobile-links')).toBeVisible();
     await page.locator('#mobile-links a[href="#/catalog/cezve"]').click();
   }else{
     await page.locator('.nav a[href="#/catalog/cezve"]').click();
   }
   await expect(page.locator('.catalog-hero h1')).toContainText('Cezve');
   const overflowCatalog=await page.evaluate(()=>document.documentElement.scrollWidth);
   expect(overflowCatalog,'horizontal overflow on catalog at '+width+'px').toBeLessThanOrEqual(width+2);
   await page.screenshot({path:'test-results/home-and-catalog-'+width+'.png',fullPage:false});
 });
}
test('customer product page and disabled checkout',async({page})=>{
 await page.setViewportSize({width:390,height:850});
 await page.goto('/#/product/el-dovmesi-bakir-cezve');
 await expect(page.locator('.detail h1')).toContainText('Cezve');
 await page.locator('.detail button[data-add]').click();
 await expect(page.locator('#cart')).toHaveClass(/open/);
 await expect(page.locator('.cart-bottom button')).toBeDisabled();
});
test('admin screen remains a login gate',async({page})=>{
 await page.setViewportSize({width:375,height:850});
 await page.goto('/admin.html');
 await expect(page.locator('#login-form')).toBeVisible();
 await expect(page.locator('.app-shell')).toHaveCount(0);
});
