import test from 'node:test';
import assert from 'node:assert/strict';
import {titleFacts,fallbackProductContent,productContent} from '../src/product-content.js';
test('only product-name labels become structured hints',()=>{
 const p={name:'Elit Bakır Bakraç 3 No 17 cm El Dövme Oksit',supplier_sku:'BB0252-3',source_host:'bakirbul.com'};
 const facts=titleFacts(p);
 assert.equal(facts.find(x=>x.label==='Ölçü')?.value,'17 cm');
 assert.equal(facts.find(x=>x.label==='Model numarası')?.value,'3 No');
 assert.equal(facts.find(x=>x.label==='İşçilik')?.value,'El Dövme');
 assert.equal(facts.find(x=>x.label==='Yüzey / renk')?.value,'Oksit');
 assert.equal(facts.some(x=>/kalay|stok|kapasite/i.test(x.label)),false);
});
test('unverified product descriptions do not claim physical characteristics',()=>{
 const p={name:'Bakır Buhurdanlık Model B',supplier_sku:'BB2615-1',source_host:'bakirbul.com'};
 const c=fallbackProductContent(p,'dekor');
 assert.equal(c.reviewed,false);
 assert.match(c.description,/Bakır Buhurdanlık Model B/);
 assert.match(c.description,/BB2615-1/);
 assert.doesNotMatch(c.description,/185 gram|%100|0[,.]5 mm|stokta/i);
 assert.equal(c.facts.length,0);
});
test('only explicitly approved descriptions override the provisional copy',()=>{
 const p={name:'Bakır Sunum Tabağı',supplier_sku:'TEST-5',
  content:{review_status:'draft',description:'Bu metin taslak ve müşteriye görünmez.'}};
 assert.equal(productContent(p,'sunum').reviewed,false);
 const approval={...p,content:{review_status:'approved',
  description:'Tedarikçi belgesinde yer alan ve yönetici tarafından doğrulanan bu sunum tabağının ürün açıklaması.',specifications:{Ölçü:'20 cm'},short_description:'Sunum tabağı'}};
 const out=productContent(approval,'sunum');
 assert.equal(out.reviewed,true);
 assert.equal(out.facts[0].value,'20 cm');
 assert.match(out.description,/tedarikçi belgesinde/i);
});
