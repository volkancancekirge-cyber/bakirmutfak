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
const json = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status, headers: {...cors,"Content-Type":"application/json;charset=utf-8","Cache-Control":"no-store"}
});
function fail(code, message){return json({ok:false,error:message},code);}

function safeProductUrl(raw) {
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
function htmlDecode(v){
 return String(v||"").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
  .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Math.min(+n,1114111)));
}
function attr(tag, key) {
 const re=new RegExp("(?:^|\\s)"+key+"\\s*=\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|([^\\s>]+))","i");
 const m=tag.match(re);
 return htmlDecode(m?.[1]??m?.[2]??m?.[3]??"");
}
function imagesFromJsonLd(doc) {
 const arr=[];
 const visit=(v)=>{
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
function extract(doc,base,host){
 const meta=[];
 for(const m of doc.matchAll(/<meta\b[^>]{0,1500}>/gi)){
  const tag=m[0],name=(attr(tag,"property")||attr(tag,"name")).toLowerCase();
  if(["og:image","og:image:secure_url","twitter:image"].includes(name))
   meta.push(attr(tag,"content"));
 }
 const schema=imagesFromJsonLd(doc);
 const images=[];
 const allow=(raw)=>{
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
async function readLimited(response,maxBytes){
 const len=Number(response.headers.get("content-length")||0);
 if(len>maxBytes)throw Error("Kaynak dosya boyut sınırını aşıyor.");
 const reader=response.body?.getReader();
 if(!reader)throw Error("Boş yanıt.");
 const parts=[];
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
function mimeOf(buffer,header){
 if(header.includes("image/jpeg")&&buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return ["image/jpeg","jpg"];
 if(header.includes("image/png")&&[137,80,78,71,13,10,26,10].every((n,i)=>buffer[i]===n))return ["image/png","png"];
 if(header.includes("image/webp")&&new TextDecoder().decode(buffer.slice(0,4))==="RIFF"&&new TextDecoder().decode(buffer.slice(8,12))==="WEBP")return ["image/webp","webp"];
 throw Error("Görsel JPEG, PNG veya WebP olarak doğrulanamadı.");
}
async function fetchSource(url,kind){
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
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return fail(405,"Yalnızca POST kullanılır.");
 if(req.headers.get("origin") !== "https://bakirmutfak.vercel.app")return fail(403,"Site kaynağı onaylı değil.");
 const bearer=req.headers.get("Authorization")||"";
 const token=bearer.startsWith("Bearer ")?bearer.slice(7):"";
 if(!token||!PROJECT_URL||!PUBLISHABLE_KEY)return fail(401,"Yönetici girişi gerekli.");
 try{
  const supabase=createClient(PROJECT_URL,PUBLISHABLE_KEY,{
   auth:{persistSession:false,autoRefreshToken:false},
   global:{headers:{Authorization:"Bearer "+token}}
  });
  const {data:{user},error:authErr}=await supabase.auth.getUser(token);
  if(authErr||!user)return fail(401,"Yönetici oturumu doğrulanamadı.");
  const {data:admin,error:admErr}=await supabase.from("bm_admin_users").select("role")
   .eq("user_id",user.id).maybeSingle();
  if(admErr||!admin||!["owner","editor"].includes(admin.role))return fail(403,"Yönetici yetkisi gerekli.");

  const input=await req.json().catch(()=>({}));
  const mode=input.mode==="import"?"import":"preview";
  const {url,host}=safeProductUrl(input.source_url);
  const {data:approved,error:sourceErr}=await supabase.from("bm_research_sources")
    .select("id").eq("source_host",host).eq("rights_status","approved").limit(1);
  if(sourceErr||!approved?.length)return fail(403,"Bu kaynağın kullanım izni onaylı değil.");

  const html=await fetchSource(url,"page");
  const parsed=extract(html,url,host);
  if(!parsed.images.length)return fail(422,"Bu ürün sayfasında güvenle ayırt edilebilen fotoğraf bulunamadı.");
  if(mode==="preview")return json({ok:true,source_url:url,source_host:host,name:parsed.name,
   supplier_sku:parsed.sku,image_urls:parsed.images,mode:"preview"});

  const selected=Array.isArray(input.selected_urls)?input.selected_urls.filter(x=>typeof x==="string"):[];
  const picked=[...new Set(selected)].filter(x=>parsed.images.includes(x)).slice(0,4);
  if(picked.length<1)return fail(422,"Kaynak sayfadaki fotoğraflardan en az birini seçmelisin.");
  if(selected.some(x=>!parsed.images.includes(x)))return fail(422,"Kaynakta olmayan görsel seçilemez.");

  if(parsed.sku){
   const {data:duplicate}=await supabase.from("bm_product_candidates")
     .select("id,source_url").eq("supplier_sku",parsed.sku).limit(1);
   if(duplicate?.length && duplicate[0].source_url!==url)
    return fail(409,"Aynı tedarikçi SKU'su başka bir kaynakta zaten bulunuyor; kopya ürün oluşturulmadı.");
  }
  const urls=[];
  const warnings=[];
  for(const imageUrl of picked){
   try{
    const resolved=new URL(imageUrl);
    const imgHost=resolved.hostname.toLowerCase();
    if(!(imgHost===host||imgHost.endsWith("."+host)||allowedHosts.has(imgHost)))throw Error("Harici fotoğraf sunucusu onaylı değil");
    const fetched=await fetchSource(imageUrl,"image");
    const [contentType,ext]=mimeOf(fetched.data,fetched.contentType);
    const filename="candidates/"+host+"/"+crypto.randomUUID()+"."+ext;
    const {error:uploadErr}=await supabase.storage.from("bm-product-images")
      .upload(filename,new Blob([fetched.data],{type:contentType}),
        {contentType,upsert:false,cacheControl:"3600"});
    if(uploadErr)throw Error("Storage upload failed");
    const {data:publicUrl}=supabase.storage.from("bm-product-images").getPublicUrl(filename);
    urls.push(publicUrl.publicUrl);
   }catch(e){warnings.push(String(e instanceof Error?e.message:"Görsel aktarılamadı").slice(0,130));}
  }
  if(!urls.length)return fail(422,"Fotoğraflar doğrulanamadı veya kaydedilemedi. Yanlış görsel yüklenmedi.");

  const {data:rows,error:dbError}=await supabase.from("bm_product_candidates").upsert({
   source_url:url,source_host:host,supplier_sku:parsed.sku,name:parsed.name,
   source_image_urls:picked,image_urls:urls,review_status:"needs_review",
   created_by:user.id,updated_at:new Date().toISOString()
  },{onConflict:"source_url"}).select("id,name,supplier_sku,image_urls,review_status").limit(1);
  if(dbError)return fail(500,"Aday kaydı oluşturulamadı; kopyalanan fotoğraflar satış ürünü değildir.");
  return json({ok:true,mode:"import",candidate:rows?.[0],downloaded:urls.length,warnings});
 }catch(e){
  return fail(422,String(e instanceof Error?e.message:"İşlem tamamlanamadı.").slice(0,180));
 }
});
