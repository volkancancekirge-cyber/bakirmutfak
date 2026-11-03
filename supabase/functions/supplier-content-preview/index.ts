// Administrator-only preview of approved supplier metadata. Never writes catalog data.
import {createClient} from "npm:@supabase/supabase-js@2.78.0";
const base=Deno.env.get("SUPABASE_URL")||"",key=Deno.env.get("SUPABASE_ANON_KEY")||"";
const trusted=new Set(["bakirbul.com","thecoppery.com"]);
const cors={"Access-Control-Allow-Origin":"https://bakirmutfak.vercel.app",
 "Access-Control-Allow-Methods":"POST,OPTIONS",
 "Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info",
 "Vary":"Origin","Cache-Control":"no-store"};
const json=(status:number,data:unknown)=>new Response(JSON.stringify(data),
 {status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
function allowed(raw:string){
 const u=new URL(raw);const host=u.hostname.toLowerCase();
 if(u.protocol!=="https:"||!trusted.has(host)||u.port||u.username||u.password||u.hash||u.search)
   throw Error("Kaynak bağlantısı izinli değil.");
 if(host==="bakirbul.com"&&!/^\/urun\/[^?#]+\/?$/.test(u.pathname))
   throw Error("BakırBul ürün sayfası bekleniyor.");
 if(host==="thecoppery.com"&&!/^\/tr\/urun\/[^?#]+\/?$/.test(u.pathname))
   throw Error("The Coppery ürün sayfası bekleniyor.");
 return u;
}
function decodeHtml(s:string){
 return s.replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
 .replace(/&lt;/gi,"<").replace(/&gt;/gi,">").replace(/&nbsp;/gi," ")
 .replace(/&#(\d{1,7});/g,(_,n)=>String.fromCodePoint(Math.min(+n,1114111)));
}
function plain(v:unknown,max=2600){
 return decodeHtml(String(v||"").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
 .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," "))
 .replace(/\s+/g," ").trim().slice(0,max);
}
function attr(tag:string,name:string){
 const m=tag.match(new RegExp("(?:^|\\s)"+name+"\\s*=\\s*(?:\\\"([^\\\"]*)\\\"|'([^']*)'|([^\\s>]+))","i"));
 return decodeHtml(m?.[1]??m?.[2]??m?.[3]??"");
}
function extract(html:string){
 let jsonDescription="",title="",specs:Record<string,string>={};
 const visit=(v:any)=>{
  if(!v||typeof v!=="object")return;
  if(Array.isArray(v)){for(const part of v)visit(part);return;}
  if(v["@graph"])visit(v["@graph"]);
  const kinds=Array.isArray(v["@type"])?v["@type"]:[v["@type"]];
  if(!kinds.some((x:any)=>typeof x==="string"&&/(?:^|[/#])Product$/i.test(x)))return;
  if(!jsonDescription&&v.description)jsonDescription=plain(v.description);
  if(!title&&v.name)title=plain(v.name,250);
  if(Array.isArray(v.additionalProperty)){
   for(const entry of v.additionalProperty.slice(0,18)){
    const label=plain(entry?.name||entry?.propertyID,60),value=plain(entry?.value,120);
    if(label&&value&&Object.keys(specs).length<15)specs[label]=value;
   }
  }
 };
 for(const m of html.matchAll(/<script\b[^>]{0,500}type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]{1,100000}?)<\/script>/gi)){
  try{visit(JSON.parse(m[1]));}catch{/* metadata may be malformed */}
 }
 let meta="";
 for(const m of html.matchAll(/<meta\b[^>]{0,1800}>/gi)){
  const t=m[0],name=(attr(t,"name")||attr(t,"property")).toLowerCase();
  if(!meta&&["description","og:description","twitter:description"].includes(name))meta=plain(attr(t,"content"));
  if(!title&&name==="og:title")title=plain(attr(t,"content"),250);
 }
 const description=(jsonDescription.length>=30?jsonDescription:meta).slice(0,2600);
 return {description,short_description:meta.slice(0,600),specifications:specs,source_title:title};
}
async function limitedText(r:Response,maxBytes=650000){
 const size=Number(r.headers.get("content-length")||0);if(size>maxBytes)throw Error("Kaynak sayfa boyutu sınırı aşıyor.");
 const reader=r.body?.getReader();if(!reader)throw Error("Kaynak yanıtı boş.");
 const parts:Uint8Array[]=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;
  total+=value.length;if(total>maxBytes)throw Error("Kaynak sayfa boyutu sınırı aşıyor.");parts.push(value);
 }}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(total);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 return new TextDecoder().decode(bytes);
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(req.method!=="POST")return json(405,{error:"POST gerekli."});
 if(req.headers.get("origin")!=="https://bakirmutfak.vercel.app")return json(403,{error:"Kaynak site izinli değil."});
 const token=(req.headers.get("authorization")||"").replace(/^Bearer\s+/i,"");
 if(!token||!base||!key)return json(401,{error:"Yönetici oturumu gerekli."});
 try{
  const body=await req.text();if(body.length>2048)return json(413,{error:"İstek çok büyük."});
  const {product_id}=JSON.parse(body);
  if(typeof product_id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(product_id))
   return json(422,{error:"Ürün kimliği geçersiz."});
  const client=createClient(base,key,{auth:{persistSession:false,autoRefreshToken:false},
   global:{headers:{Authorization:"Bearer "+token}}});
  const {data:{user},error:authError}=await client.auth.getUser(token);
  if(authError||!user)return json(401,{error:"Yönetici oturumu doğrulanamadı."});
  const {data:admin,error:adminError}=await client.from("bm_admin_users").select("role").eq("user_id",user.id).maybeSingle();
  if(adminError||!["owner","editor"].includes(admin?.role))return json(403,{error:"Yönetici yetkisi bulunmuyor."});
  const {data:p,error:dbError}=await client.from("bm_source_catalog").select("id,name,source_url,source_host")
   .eq("id",product_id).maybeSingle();
  if(dbError||!p)return json(404,{error:"Kaynak ürün kaydı bulunamadı."});
  const u=allowed(p.source_url);
  const {data:approved,error:sourceError}=await client.from("bm_research_sources").select("id")
   .eq("source_host",u.hostname).eq("rights_status","approved").limit(1);
  if(sourceError||!approved?.length)return json(403,{error:"Kaynak ticari kullanım için onaylanmamış."});
  const response=await fetch(u.toString(),{redirect:"error",signal:AbortSignal.timeout(10000),
   headers:{"Accept":"text/html,application/xhtml+xml","User-Agent":"BakirMutfakApprovedResearch/1.0"}});
  if(!response.ok)return json(422,{error:"Tedarikçi sayfası okunamadı ("+response.status+")."});
  if(!/text\/html|application\/xhtml\+xml/i.test(response.headers.get("content-type")||""))
   return json(422,{error:"Kaynak sayfası HTML değil."});
  const html=await limitedText(response);
  const parsed=extract(html);
  if(parsed.description.length<30)return json(422,{error:"Bu kaynakta güvenilir açıklama metni bulunamadı. Ürünü kaynak sitesinde açıp manuel doğrulayabilirsin."});
  return json(200,{ok:true,source_url:u.toString(),source_host:u.hostname,source_kind:"supplier_page",
   name:p.name,source_title:parsed.source_title,...parsed,review_status:"draft",requires_review:true});
 }catch(e){return json(422,{error:String(e instanceof Error?e.message:"Kaynak okunamadı").slice(0,170)});}
});
