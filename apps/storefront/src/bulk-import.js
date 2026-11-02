import {bulkCatalogAction,bulkQueueStatus} from './supabase.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let stopping=false;
const sources=[['bakirbul.com','BakırBul'],['thecoppery.com','The Coppery']];
function line(item){return '<span>'+esc(item.host)+'</span> <b>'+item.count+'</b>'}
export async function mountBulkCatalog(root){
 root.querySelector('#bm-bulk-import')?.remove();
 const pane=document.createElement('section');
 pane.id='bm-bulk-import';pane.className='panel bulk-import-panel';
 pane.innerHTML='<div class="panel-head"><div><span class="eyebrow">ONAYLI KAYNAKLAR / TOPLU KATALOG</span><h2>İki kaynağı tek seferde tara</h2><p>Kaynak sayfaları bulur, aynı SKU\'ları ayıklar ve doğrulanmış fotoğrafları Supabase\'e alır. Fotoğraflı ürünler fiyatsız, siparişe kapalı katalog görünümünde açılır.</p></div></div>'+
 '<div class="bulk-stats" id="bulk-stats">Kuyruk yükleniyor…</div>'+
 '<div class="bulk-actions"><button id="bulk-discover" class="primary">İki kataloğu keşfet ve içe aktar ↗</button><button id="bulk-resume" class="outline">Kaldığı yerden devam et</button><button id="bulk-stop" class="outline" disabled>Durdur</button></div>'+
 '<div role="status" id="bulk-report" class="info-note">İşlem açık tarayıcı sekmesinde ilerler; durduğunda kaydedilen kuyruktan devam edilebilir. Katalog işlemi gerçek ürün fiyatı veya stok oluşturmaz.</div>';
 root.querySelector('.workspace-footer')?.before(pane);
 if(!pane.isConnected)root.append(pane);
 const stats=pane.querySelector('#bulk-stats');
 const report=pane.querySelector('#bulk-report');
 const discover=pane.querySelector('#bulk-discover');
 const resume=pane.querySelector('#bulk-resume');
 const stop=pane.querySelector('#bulk-stop');
 async function refresh(){
   try{
     const rows=await bulkQueueStatus();
     const counts=sources.map(([host,name])=>{
       const subset=rows.filter(x=>x.source_host===host);
       return {host:name,queued:subset.length,done:subset.filter(x=>x.status==='imported').length,
         failed:subset.filter(x=>x.status==='failed').length,
         skipped:subset.filter(x=>x.status==='skipped').length,
         pending:subset.filter(x=>x.status==='pending').length};
     });
     stats.innerHTML=counts.map(x=>'<div class="bulk-stat"><b>'+esc(x.host)+'</b><strong>'+x.done+'</strong><span>Aktarıldı / '+x.queued+' keşfedildi</span><small>'+x.pending+' bekliyor · '+x.failed+' hata · '+x.skipped+' tekrar</small></div>').join('');
   }catch(e){stats.textContent='Kuyruk durumu okunamadı: '+e.message;}
 }
 await refresh();
 stop.onclick=()=>{stopping=true;stop.disabled=true;report.textContent='Durdurma istendi. Mevcut çağrı tamamlandığında duracak.'};
 const run=async(withDiscovery)=>{
   if(!confirm('BakırBul ve The Coppery onaylı kaynaklarını toplu taramak istiyor musun? İçe aktarılan görseller herkese açık katalogda gösterilebilir; alış/satış fiyatı ve stok oluşturulmaz.'))return;
   stopping=false;discover.disabled=true;resume.disabled=true;stop.disabled=false;
   try{
     for(const [host,name] of sources){
       if(stopping)break;
       if(withDiscovery){
         let last=-1,steady=0;
         for(let page=1;page<=80&&!stopping;page++){
           report.textContent=name+' katalog keşfi: '+page+'. sayfa / sitemap taranıyor…';
           let result;
           try{result=await bulkCatalogAction({mode:'discover',host,page});}
           catch(e){if(page===1)throw e;break;}
           if((result.queued||0)===last)steady++;else steady=0;
           last=result.queued||0;
           if(steady>=2||(page>1&&!result.found))break;
           if(page%3===0)await refresh();
         }
       }
       let failures=0;
       for(let cycle=0;cycle<2000&&!stopping;cycle++){
         report.textContent=name+' ürünleri işleniyor: parti '+(cycle+1)+'…';
         const result=await bulkCatalogAction({mode:'process',host,limit:3});
         if(!result.processed)break;
         failures=result.results?.filter(x=>x.status==='failed').length||0;
         if(cycle%2===0)await refresh();
       }
       await refresh();
     }
     report.textContent=stopping?'İşlem durduruldu. Kaldığı yerden devam edebilirsin.':'Toplu tarama tamamlandı veya kaynakta daha fazla erişilebilir ürün bulunamadı. Durumu yukarıdan kontrol et.';
   }catch(e){report.textContent='İşlem durdu: '+e.message+' · Kaldığı yerden devam edebilirsin.';}
   finally{stopping=true;discover.disabled=false;resume.disabled=false;stop.disabled=true;await refresh();}
 };
 discover.onclick=()=>run(true);
 resume.onclick=()=>run(false);
}
