import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('production preview is non-indexable until catalog and legal pages are complete',()=>{
 const html=read('index.html'),headers=JSON.parse(read('vercel.json')).headers[0].headers;
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.ok(headers.some(h=>h.key==='X-Robots-Tag'&&h.value.includes('noindex')));
});
test('security headers block framing and restrict client connections',()=>{
 const headers=JSON.parse(read('vercel.json')).headers[0].headers;
 const csp=headers.find(h=>h.key==='Content-Security-Policy')?.value;
 assert.ok(csp?.includes("frame-ancestors 'none'"));
 assert.ok(csp?.includes("object-src 'none'"));
 assert.ok(csp?.includes("connect-src 'self' https://*.supabase.co"));
 assert.ok(headers.some(h=>h.key==='X-Frame-Options'&&h.value==='DENY'));
});
test('browser never receives Supabase secret service keys',()=>{
 for(const path of ['index.html','src/hydra.js','src/hydra-admin.js','src/quote-admin.js','src/supabase.js']){
  assert.doesNotMatch(read(path),/SUPABASE_(SERVICE_ROLE_KEY|SECRET_KEYS)/);
  assert.doesNotMatch(read(path),/sb_secret_[A-Za-z0-9_-]{10}/);
 }
});
test('customer quote backend requires item validation and a submission limit',()=>{
 const sql=read('../../supabase/migrations/20261103132500_hydra_admin_merch_quotes.sql');
 const edge=read('../../supabase/functions/hydra-quote-request/index.ts');
 assert.match(sql,/alter table public\.bm_quote_requests enable row level security/);
 assert.match(sql,/revoke all on public\.bm_quote_requests from public,anon,authenticated/);
 assert.match(edge,/products\.length>20/);
 assert.match(edge,/privacy_accepted_at/);
 assert.match(edge,/ipHash/);
 assert.match(edge,/emailHash/);
});
