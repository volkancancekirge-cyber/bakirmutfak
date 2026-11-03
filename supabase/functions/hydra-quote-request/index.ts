// Public Hydra quote requests; only this server can write private customer data.
import { createClient } from "npm:@supabase/supabase-js@2.78.0";
const baseUrl=Deno.env.get("SUPABASE_URL")||"";
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const cors={"Access-Control-Allow-Origin":"https://bakirmutfak.vercel.app","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"apikey,authorization,content-type,x-client-info","Cache-Control":"no-store","Vary":"Origin"};
const respond=(status:number,data:unknown)=>new Response(JSON.stringify(data),{status,headers:{...cors,"Content-Type":"application/json; charset=utf-8"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const trim=(v:unknown)=>typeof v==="string"?v.trim():"";
async function hash(value:string){
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const raw=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(value));
 return [...new Uint8Array(raw)].map(n=>n.toString(16).padStart(2,"0")).join("");
}
Deno.serve(async(request)=>{
 if(request.method==="OPTIONS")return new Response(null,{status:204,headers:cors});
 if(request.method!=="POST")return respond(405,{error:"Geçersiz istek."});
 if(request.headers.get("origin")!=="https://bakirmutfak.vercel.app")return respond(403,{error:"İzin verilmeyen kaynak."});
 if(!baseUrl||!secret)return respond(503,{error:"Teklif hizmeti kullanılamıyor."});
 let body:Record<string,unknown>;
 try{
  const text=await request.text();
  if(text.length>12000)return respond(413,{error:"Talep çok büyük."});
  const value=JSON.parse(text);
  if(!value||typeof value!=="object"||Array.isArray(value))throw Error("invalid");
  body=value as Record<string,unknown>;
 }catch{return respond(400,{error:"Bilgiler okunamadı."});}
 if(trim(body.website))return respond(200,{ok:true,message:"Talebiniz alındı."});
 const name=trim(body.name),email=trim(body.email).toLowerCase();
 const phone=trim(body.phone),message=trim(body.message),products=body.product_ids;
 if(name.length<2||name.length>120||!name.replace(/\s/g,""))return respond(422,{error:"Ad soyad alanını kontrol edin."});
 if(email.length<6||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  return respond(422,{error:"E-posta adresini kontrol edin."});
 if(phone.length>30||message.length>1500||body.consent!==true)
  return respond(422,{error:"İletişim bilgileri veya aydınlatma onayı eksik."});
 if(!Array.isArray(products)||products.length<1||products.length>20||
    !products.every(v=>typeof v==="string"&&uuid.test(v))||new Set(products).size!==products.length)
  return respond(422,{error:"1–20 geçerli ürün seçin."});
 const ids=products as string[];
 const client=createClient(baseUrl,secret,{auth:{autoRefreshToken:false,persistSession:false}});
 try{
  const ip=trim(request.headers.get("cf-connecting-ip")||request.headers.get("x-real-ip")||
   request.headers.get("x-forwarded-for")?.split(",")[0]||"unknown").slice(0,90);
  const ipHash=await hash("ip:"+ip),emailHash=await hash("email:"+email);
  const since=new Date(Date.now()-3600000).toISOString();
  const counts=await Promise.all([
    client.from("bm_quote_requests").select("id",{head:true,count:"exact"}).eq("ip_hash",ipHash).gte("created_at",since),
    client.from("bm_quote_requests").select("id",{head:true,count:"exact"}).eq("email_hash",emailHash).gte("created_at",since)
  ]);
  if(counts.some(v=>v.error))throw Error("rate check failed");
  if(counts.some(v=>(v.count||0)>=3))return respond(429,{error:"Çok fazla talep gönderildi. Daha sonra yeniden deneyin."});
  const idsFilter="("+ids.join(",")+")";
  const results=await Promise.all([
    client.from("bm_source_catalog").select("id,name,supplier_sku").eq("visibility","visible").filter("id","in",idsFilter),
    client.from("bm_products").select("id,name,sku").eq("published",true).filter("id","in",idsFilter)
  ]);
  if(results.some(v=>v.error))throw Error("product check failed");
  const names=new Map([...results[0].data||[],...results[1].data||[]].map(p=>[p.id,p]));
  if(names.size!==ids.length)return respond(422,{error:"Bazı ürünler artık katalogda yok. Listenizi yenileyin."});
  const snapshot=ids.map(id=>{
    const p=names.get(id);
    return {id,name:String(p.name).slice(0,250),sku:String(p.supplier_sku||p.sku||"").slice(0,120)};
  });
  const {data,error}=await client.from("bm_quote_requests").insert({
    contact_name:name,contact_email:email,contact_phone:phone,message,items:snapshot,
    privacy_accepted_at:new Date().toISOString(),ip_hash:ipHash,email_hash:emailHash
  }).select("id").single();
  if(error)throw Error("insert failed");
  return respond(200,{ok:true,reference:data.id,message:"Teklif talebiniz alındı."});
 }catch{return respond(503,{error:"Talep şu anda alınamadı. Lütfen tekrar deneyin."});}
});
