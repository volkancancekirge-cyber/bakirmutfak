import { createClient } from "npm:@supabase/supabase-js@2";

const PROJECT_URL = Deno.env.get("SUPABASE_URL") || "";
const PUBLISHABLE_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const allowedHosts = new Set(["bakirbul.com", "thecoppery.com"]);
const cors = {
  "Access-Control-Allow-Origin": "https://bakirmutfak.vercel.app",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (payload: unknown, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: {...cors,"Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store"}
});
function fail(code: number, message: string){return json({ok:false,error:message},code);}

function safeProductUrl(raw: unknown) {
  if(typeof raw !== "string" || raw.length < 25 || raw.length > 1800) throw Error("Geçerli ürün bağlantısı gerekli.");
  let u;
  try { u = new URL(raw); } catch { throw Error("Ürün URL'si geçersiz."); }
  const host=u.hostname.toLowerCase().replace(/\.$/,"");
  if(u.protocol !== "https:" || !allowedHosts.has(host) || u.username || u.password
      || u.port || u.hash) throw Error("Yalnızca iki onaylı kaynağın HTTPS bağlantıları desteklenir.");
  if(host==="bakirbul.com" && !/^\/urun\/[^/?#]+\/?$/.test(u.pathname)) {
    throw Error("BakırBul için doğrudan /urun/ bağlantısı gerekli.");
  }
  if(host==="thecoppery.com" && !/^\/tr\/urun\/[^/?#]+\/?$/.test(u.pathname)) {
    throw Error("The Coppery için doğrudan /tr/urun/ bağlantısı gerekli.");
  }
  u.search="";
  return {url:u.toString(),host};
}
function htmlDecode(v: unknown){
 return String(v||"").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(+n,1114111)));
}
function attr(tag: string, key: string) {
 const re=new RegExp("(?:^|\\s)"+key+"\\s*=\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|([^\\s>]+))","i");
 const m=tag.match(re);
 return htmlDecode(m?.[1]??m?.[2]??m?.[3]??"");
}
function imagesFromJsonLd(doc: string) {
 const arr: any[]=[];
 const visit=(v: any)=>{
  if(!v || typeof v !== "object")return;
  if(Array.isArray(v)){for(const x of v)visit(x);return;}
  if(v["@graph"])visit(v["@graph"]);
  const types=Array.isArray(v["@type"])?v["@type"]:[v["@type"]];
  if(types.some(t=>typeof t==="string" && /(?:^|[/#])Product$/i.test(t))){
   const raw=Array.isArray(v.image)?v.image:[v.image];
   for(const i of raw){
    if(typeof i==="string")arr.push(i);
    else if(i && typeof i==="object" && typeof i.url==="string")arr.push(i.url);
   }
   if(typeof v.name==="string")arr.push({title:v.name});
   if(typeof v.sku==="string")arr.push({sku:v.sku});
  }
 };
 for(const m of doc.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{visit(JSON.parse(m[1]));}catch{/* skip invalid schema */}
 }
 return arr;
}
function extract(doc: string,base: string,host: string){
 const meta=[];
 for(const m of doc.matchAll(/<meta\b[^>]{0,1500}>/gi)){
  const tag=m[0],name=(attr(tag,"property")||attr(tag,"name")).toLowerCase();
  if(["og:image","og:image:secure_url","twitter:image"].includes(name))
   meta.push(attr(tag,"content"));
 }
 const schema=imagesFromJsonLd(doc);
 const images: string[]=[];
 const allow=(raw: unknown)=>{
  if(typeof raw!=="string"||raw.length>1800)return;
  let u;
  try{u=new URL(htmlDecode(raw),base)}catch{return;}
  if(u.protocol!=="https:"||u.username||u.password||u.port||u.hash)return;
  const h=u.hostname.toLowerCase();
  if(!(h===host || h.endsWith("."+host) || allowedHosts.has(h)))return;
  if(/(?:logo|avatar|favicon|placeholder|sprite|icon)[-_./]/i.test(u.pathname))return;
  if(!images.includes(u.toString()))images.push(u.toString());
 };
 for(const v of [...schema,...meta])allow(v);
 // Fall back only to product gallery image elements, not arbitrary page decoration.
 if(images.length===0){
  for(const m of doc.matchAll(/<img\b[^>]{0,2500}>/gi)){
   const tag=m[0],cl=(attr(tag,"class")+" "+attr(tag,"alt")).toLowerCase();
   if(!/(product|urun|ürün|cezve|bakır|bakir|çaydan|tencere|woo)/.test(cl))continue;
   allow(attr(tag,"data-large_image")||attr(tag,"data-src")||attr(tag,"src"));
  }
 }
 const title=htmlDecode(
  schema.find(x=>x && typeof x==="object" && typeof x.title==="string")?.title
  || (()=>{for(const m of doc.matchAll(/<meta\b[^>]{0,1500}>/gi)){if(attr(m[0],"property").toLowerCase()==="og:title")return attr(m[0],"content");}return ""})()
  || doc.match(/<h1\b[^>]*>([\s\S]{1,400}?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g,"")
  || "Bakır ürün görseli adayı"
 ).replace(/\s+/g," ").trim().slice(0,250);
 const supplierSku=String(
  schema.find(x=>x && typeof x==="object" && typeof x.sku==="string")?.sku
  || new URL(base).pathname.match(/(bb\d{3,8}-\d+)/i)?.[1] || ""
 ).toUpperCase();
 return {name:title,sku:/^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$/.test(supplierSku)?supplierSku:null,images:images.slice(0,8)};
}
async function readLimited(response: Response,maxBytes: number): Promise<Uint8Array>{
 const len=Number(response.headers.get("content-length")||0);
 if(len>maxBytes)throw Error("Kaynak dosya boyut sınırını aşıyor.");
 const reader=response.body?.getReader();
 if(!reader)throw Error("Boş yanıt.");
 const parts: Uint8Array[]=[];
 let total=0;
 try {
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.length;
   if(total>maxBytes)throw Error("Kaynak dosya boyut sınırını aşıyor.");
   parts.push(value);
  }
 }finally{await reader.cancel().catch(()=>{});}
 const buf=new Uint8Array(total);
 let offset=0;
 for(const x of parts){buf.set(x,offset);offset+=x.length;}
 return buf;
}
function mimeOf(buffer: Uint8Array,header: string): [string,string]{
 if(header.includes("image/jpeg")&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return ["image/jpeg","jpg"];
 if(header.includes("image/png")&&[137,80,78,71,13,10,26,10].every((n,i)=>buffer[i]===n))return ["image/png","png"];
 if(header.includes("image/webp")&&new TextDecoder().decode(buffer.slice(0,4))==="RIFF"&&new TextDecoder().decode(buffer.slice(8,12))==="WEBP")return ["image/webp","webp"];
 throw Error("Görsel JPEG, PNG veya WebP olarak doğrulanamadı.");
}
async function fetchSource(url: string,kind: 'page'): Promise<string>;
async function fetchSource(url: string,kind: 'image'): Promise<{data:Uint8Array,contentType:string}>;
async function fetchSource(url: string,kind: 'page'|'image'): Promise<string|{data:Uint8Array,contentType:string}>{
 const r=await fetch(url,{
  method:"GET",redirect:"error",
  signal:AbortSignal.timeout(12000),
  headers:{"Accept":kind==="page"?"text/html,application/xhtml+xml":"image/webp,image/png,image/jpeg","User-Agent":"BakirMutfakApprovedImporter/1.0"}
 });
 if(!r.ok)throw Error("Kaynak sunucu yanıt vermedi ("+r.status+").");
 const ct=(r.headers.get("content-type")||"").toLowerCase();
 if(kind==="page"&&!ct.includes("text/html"))throw Error("Ürün sayfası HTML değil.");
 const data=await readLimited(r,kind==="page"?1_500_000:5*1024*1024);
 if(kind==="page")return new TextDecoder().decode(data);
 return {data,contentType:ct};
}

// Bulk product catalog reader. All writes use the caller's admin JWT.
const chooseCategory=(text: string):'cezve'|'caydanlik'|'tencere'|'sofra'=> {
  const t=text.toLocaleLowerCase("tr");
  if(/cezve|kahve/.test(t))return "cezve";
  if(/çaydan|caydan|demlik/.test(t))return "caydanlik";
  if(/tencere|tava|sahan|güveç|guvec|kavurma/.test(t))return "tencere";
  return "sofra";
};
function extractProductUrls(text:string, baseUrl:string, host:string):string[]{
 const found:string[]=[];
 const add=(raw:string)=>{
  let u:URL;
  try{u=new URL(htmlDecode(raw.trim()),baseUrl);}catch{return;}
  if(u.protocol!=="https:"||u.hostname.toLowerCase()!==host||u.username||u.password||u.port)return;
  if(host==="bakirbul.com"&&!/^\/urun\/[^/]+\/?$/.test(u.pathname))return;
  if(host==="thecoppery.com"&&!/^\/tr\/urun\/[^/]+\/?$/.test(u.pathname))return;
  u.hash="";u.search="";
  if(!found.includes(u.href))found.push(u.href);
 };
 for(const m of text.matchAll(/<loc\b[^>]*>\s*([^<]{1,2000})\s*<\/loc>/gi))add(m[1]);
 for(const m of text.matchAll(/\bhref\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi))add(m[1]||m[2]||m[3]);
 return found.slice(0,1300);
}
async function fetchListing(url:string,host:string):Promise<string>{
 const u=new URL(url);
 if(u.protocol!=="https:"||u.hostname!==host||u.port||u.username||u.password)
   throw Error("Yalnızca izinli kaynak alan adı kullanılabilir.");
 const response=await fetch(url,{
  redirect:"error",signal:AbortSignal.timeout(14000),
  headers:{"Accept":"text/html,application/xml,text/xml","User-Agent":"BakirMutfakApprovedImporter/1.0"}
 });
 if(!response.ok)throw Error("Katalog kaynağı HTTP "+response.status+" hatası döndürdü.");
 return new TextDecoder().decode(await readLimited(response,2_500_000));
}
type Client=ReturnType<typeof createClient>;
async function discovery(client:Client,host:string,page:number){
 const urls:string[]=[];
 const notes:string[]=[];
 const tried:string[]=[];
 const addText=(v:string,base:string)=> {
  for(const url of extractProductUrls(v,base,host))if(!urls.includes(url))urls.push(url);
 };
 if(page===1){
   const roots=host==="bakirbul.com"?
     ["/product-sitemap.xml","/product-sitemap1.xml","/wp-sitemap-posts-product-1.xml","/sitemap_index.xml","/sitemap.xml"]:
     ["/sitemap.xml","/sitemap_index.xml"];
   for(const path of roots){
     const absolute="https://"+host+path;
     try{
      const body=await fetchListing(absolute,host);
      addText(body,absolute);
      // A sitemap index points to product sub-sitemaps, not actual product URLs.
      const children=[...body.matchAll(/<loc\b[^>]*>\s*([^<]+)\s*<\/loc>/gi)]
       .map(m=>htmlDecode(m[1]))
       .filter(u=>{
         try{const v=new URL(u);return v.hostname===host && /sitemap|product/i.test(v.pathname)}catch{return false;}
       }).slice(0,20);
      for(const child of children){
        try{addText(await fetchListing(child,host),child);}catch{notes.push("Alt sitemap okunamadı.");}
        if(urls.length>=2000)break;
      }
      if(urls.length>=20)break;
     }catch{tried.push(path);}
   }
 }
 // HTML collection discovery fallback, also supports paginated sources.
 if(urls.length===0||page>1){
   const pages=host==="bakirbul.com"?
     ["/urun-kategori/mutfak-pisirme/","/urun-kategori/bardak-kadeh/","/urun-kategori/servis-sunum/","/magaza/","/shop/"]:
     ["/tr/urunler"];
   for(const route of pages){
    const path=host==="bakirbul.com"?
      (page===1?route:route.replace(/\/$/,"")+"/page/"+page+"/"):
      (page===1?route:route+"?page="+page);
    const absolute="https://"+host+path;
    try{addText(await fetchListing(absolute,host),absolute);}catch{/* inaccessible route */}
   }
 }
 const first=urls.slice(0,1200);
 if(!first.length)return {ok:true,host,page,found:0,added:0,queued:0,notes:["Katalog bağlantısı okunamadı veya yeni ürün bulunamadı.",...tried.slice(0,2)]};
 const records=first.map(source_url=>({source_url,source_host:host,status:"pending"}));
 const {error}=await client.from("bm_catalog_queue")
    .upsert(records,{onConflict:"source_url",ignoreDuplicates:true});
 if(error)throw Error("Keşfedilen ürün adresleri kuyruğa eklenemedi: "+error.message);
 const {count}=await client.from("bm_catalog_queue").select("id",{count:"exact",head:true}).eq("source_host",host);
 return {ok:true,host,page,found:first.length,queued:count||0,notes:notes.slice(0,3)};
}
async function processQueue(client:Client,userId:string,host:string,limit:number){
 const {data:entries,error}=await client.from("bm_catalog_queue")
   .select("id,source_url,source_host,attempts")
   .eq("source_host",host).eq("status","pending").lt("attempts",4)
   .order("created_at",{ascending:true}).limit(Math.min(4,Math.max(1,limit)));
 if(error)throw Error("Katalog kuyruğu okunamadı.");
 const results:{status:string,sku?:string,reason?:string}[]=[];
 for(const item of entries||[]){
  let status="failed",reason="";
  try{
   const {url}=safeProductUrl(item.source_url);
   const html=await fetchSource(url,"page");
   const parsed=extract(html,url,host);
   if(parsed.name.length<3)throw Error("Ürün adı algılanamadı");
   const candidatePayload={
     source_url:url,source_host:host,supplier_sku:parsed.sku,
     name:parsed.name,created_by:userId,updated_at:new Date().toISOString()
   };
   if(parsed.sku){
     const {data:matched}=await client.from("bm_source_catalog")
      .select("id,source_url").eq("supplier_sku",parsed.sku).limit(1);
     if(matched?.length && matched[0].source_url!==url){
       status="skipped";reason="Tedarikçi SKU'su diğer kaynakta zaten mevcut.";
       continue;
     }
   }else{
     const {data:existing}=await client.from("bm_source_catalog")
       .select("id,source_url").eq("name",parsed.name).limit(1);
     if(existing?.length && existing[0].source_url!==url){
       status="skipped";reason="Aynı isimli ürün diğer kaynakta mevcut.";
       continue;
     }
   }
   const uploaded:string[]=[];
   const acceptedSource:string[]=[];
   for(const src of parsed.images.slice(0,3)){
     try{
       const parsedUrl=new URL(src);
       const imageHost=parsedUrl.hostname.toLowerCase();
       if(!(imageHost===host||imageHost.endsWith("."+host)||allowedHosts.has(imageHost)))continue;
       const obj=await fetchSource(src,"image");
       const [type,ext]=mimeOf(obj.data,obj.contentType);
       const key="candidates/"+host+"/"+crypto.randomUUID()+"."+ext;
       const {error:uploadError}=await client.storage.from("bm-product-images")
        .upload(key,new Blob([obj.data as Uint8Array<ArrayBuffer>],{type}),
          {contentType:type,upsert:false,cacheControl:"3600"});
       if(uploadError)continue;
       const {data:ref}=client.storage.from("bm-product-images").getPublicUrl(key);
       uploaded.push(ref.publicUrl);
       acceptedSource.push(src);
     }catch{/* unavailable media is not silently substituted */}
   }
   const {error:candidateError}=await client.from("bm_product_candidates").upsert({
      ...candidatePayload,source_image_urls:acceptedSource,image_urls:uploaded,
      review_status:"needs_review"
   },{onConflict:"source_url"});
   if(candidateError)throw Error("İnceleme kaydı kaydedilemedi");
   const {error:catalogError}=await client.from("bm_source_catalog").upsert({
      source_url:url,source_host:host,supplier_sku:parsed.sku,name:parsed.name,
      category:chooseCategory(parsed.name),image_urls:uploaded,
      visibility:uploaded.length?"visible":"review",updated_at:new Date().toISOString()
   },{onConflict:"source_url"});
   if(catalogError)throw Error("Katalog ürünü kaydedilemedi");
   status="imported";
   if(!uploaded.length)reason="Görsel indirilemedi; katalog kaydı incelemede kaldı.";
  }catch(e){reason=String(e instanceof Error?e.message:"Kaynak okunamadı").slice(0,180);}
  finally{
   await client.from("bm_catalog_queue").update({
      status,last_error:reason||null,attempts:(item.attempts||0)+1,
      updated_at:new Date().toISOString()
    }).eq("id",item.id);
   results.push({status,reason});
  }
 }
 const {data:statusRows}=await client.from("bm_catalog_queue").select("status")
  .eq("source_host",host).limit(5000);
 const summary={pending:0,imported:0,failed:0,skipped:0};
 for(const row of statusRows||[]){
   if(row.status in summary)summary[row.status as keyof typeof summary]++;
 }
 return {ok:true,host,processed:results.length,results,summary};
}
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return fail(405,"Yalnızca POST.");
 if(req.headers.get("origin")!=="https://bakirmutfak.vercel.app")return fail(403,"Onaysız origin.");
 const bearer=req.headers.get("authorization")||"";
 const token=bearer.startsWith("Bearer ")?bearer.slice(7):"";
 if(!token||!PROJECT_URL||!PUBLISHABLE_KEY)return fail(401,"Yönetici oturumu gerekli.");
 try{
  const client=createClient(PROJECT_URL,PUBLISHABLE_KEY,{
    auth:{persistSession:false,autoRefreshToken:false},
    global:{headers:{Authorization:"Bearer "+token}}
  });
  const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user)return fail(401,"Geçerli yönetici oturumu gerekli.");
  const {data:admin}=await client.from("bm_admin_users").select("role")
    .eq("user_id",user.id).maybeSingle();
  if(!admin||!["owner","editor"].includes(admin.role))return fail(403,"Yönetici yetkisi gerekli.");
  const input=await req.json().catch(()=>({}));
  const host=String(input.host||"");
  if(!allowedHosts.has(host))return fail(422,"Yalnızca onaylı kaynaklar.");
  const {data:approved}=await client.from("bm_research_sources").select("id")
    .eq("source_host",host).eq("rights_status","approved").limit(1);
  if(!approved?.length)return fail(403,"Kaynak kullanım izni işaretlenmemiş.");
  if(input.mode==="discover")return json(await discovery(client,host,Math.min(80,Math.max(1,Number(input.page)||1))));
  if(input.mode==="process")return json(await processQueue(client,user.id,host,Number(input.limit)||2));
  return fail(422,"Geçersiz işlem.");
 }catch(e){return fail(422,String(e instanceof Error?e.message:"Katalog işleminde hata").slice(0,200));}
});
