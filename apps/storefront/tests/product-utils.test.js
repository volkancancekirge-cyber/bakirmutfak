import test from 'node:test';
import assert from 'node:assert/strict';
import { productSlug, validateImages, validateProduct } from '../src/product-utils.js';
const base={sku:'BM-CEZ-100',name:'Bakır Cezve',price:'1290.50',stock:'5',category:'cezve',product_type:'cezve',images:''};
test('Turkish text slug',()=>assert.equal(productSlug('İşlemeli Bakır Çaydanlık'), 'islemeli-bakir-caydanlik'));
test('normal product form',()=>{
 const x=validateProduct({...base,handmade:true,tinned:true});
 assert.equal(x.price,1290.5);assert.equal(x.stock,5);assert.equal(x.handmade,true);
});
test('invalid prices and stock blocked',()=>{
 for(const v of [{price:0},{price:-5},{price:1.111},{stock:-1},{stock:1.5},{stock:1000001}])assert.throws(()=>validateProduct({...base,...v}));
});
test('sku and category validation',()=>{
 assert.throws(()=>validateProduct({...base,sku:'BAD CODE'}));
 assert.throws(()=>validateProduct({...base,category:'other'}));
});
test('image validations',()=>{
 assert.deepEqual(validateImages('https://example.com/a.jpg\nhttps://example.com/a.jpg'),['https://example.com/a.jpg']);
 for(const v of ['http://example.com/a.jpg','https://localhost/p.png','https://example.com:9999/a.jpg',
   'https://user:secret@example.com/a.jpg','https://example.com\n'.repeat(9)])assert.throws(()=>validateImages(v));
});
