# Hydra Commerce 2.0 — Yönetim, teklif ve kalite

**Canlı ön izleme:** https://bakirmutfak.vercel.app/
**Yönetim paneli:** https://bakirmutfak.vercel.app/admin.html
**GitHub:** https://github.com/volkancancekirge-cyber/bakirmutfak
**Supabase:** proje \`zyytmsfbufgolayzrppn\`

## Uygulanan özellikler
- Hydra Vitrin Yönetimi: Hero başlığı, alt metin, hero görsel kategorisi, ana sayfa kategori sırası.
- Tedarikçi katalog ürünleri için kategori düzeltmesi, vitrin önceliği, öne çıkma ve mağaza arayüzünde gizleme (kaynak veriyi değiştirmeden ayrı tabloda).
- Karşılaştırma: 3 ürün, fiyat ve stok teyitsizken satın alma eylemi yok.
- Akıllı arama: arama terimine göre ilk 6 ürün önerisi.
- Mobil alt gezinme, görsel galeri ve 24 ürünlü sayfalama.
- İlgi listesinden teklif formu; özel Supabase tablo + server-side Edge Function, RLS tablosu ve sınırlı sayıda talep.
- Yönetici Teklif Talepleri: durum değişimi ve yalnızca adminin görebildiği notlar.
- CSP, noindex, HTTP güvenlik başlıkları, Vite asset cache ve Playwright testleri.

## Veri mimarisi
- \`bm_products\`: Eski elle eklenen ürünler. Fiyat/stok doğrulanmadıkça satış kapalı.
- \`bm_source_catalog\`: Tedarikçi ürünleri, gerçek görseller. Botun sahip olduğu veri; üzerine yazılmasın.
- \`bm_hydra_merchandising\`: Siteye özel ürün kategori/sıra tercihleri.
- \`bm_hydra_settings\`: Site vitrini ayarları, tek kayıt.
- \`bm_quote_requests\`: Özel müşteri iletişim ve teklif talebi kayıtları. \`anon\` rolüne SELECT/INSERT/UPDATE hakkı yok.
- \`hydra-quote-request\`: Kamuya açık POST; istek boyutu, ürün kimlikleri, 1–20 ürün, onay ve saatlik 3 istek/e-posta ve IP eşik kontrolü. Supabase secret key yalnızca Edge Function'da saklanır.

## Test ve yayına alma sınırları
- Kod, Deno denetimi, browser testleri ve GitHub Actions başarıyla geçtiğinde sürüm yayınlanabilir.
- Gerçek müşteri e-posta gönderim altyapısı henüz yok; yönetici panelinden talepler takip edilir.
- Gerçek banka ödeme/sipariş/kargo kapalı.
- Gerçek müşteri verisi toplanmadan önce **ticari unvan, KVKK veri sorumlusu bilgileri, saklama/imha süresi, iletişim kanalı ve nihai politika** hukuk danışmanıyla tamamlanmalı. \`privacy.html\` geçici özet, nihai metin değildir.
- Bot ürünlerinde fiyat/stok doğrulanmış değil. Teklif vermeden yönetici teyidi zorunlu.
- Hash-route URL ve \`noindex\` hâlâ aktif. SEO lansmanından önce taranabilir URL, ürün veri kalitesi, gerçek fiyat/stok ve indeksleme politikası hazırlanmalı.
- Supabase Auth güvenlik denetiminde sızdırılmış şifre kontrolünün kapalı olduğu uyarısı hâlâ var; ticari lansmandan önce ayarlanmalı.
- Rate limit, temel saatlik e-posta/IP kotasıdır; dış trafiğe açılmadan önce Turnstile/CAPTCHA, daha güçlü atomik limit ve spam/istismar izleme eklenmeli.
- Vitrinde gizleme, yalnızca Hydra görünümünü etkiler; bir ürünün halka açık DB API'sinde görünmemesi gerekiyorsa \`bm_source_catalog.visibility\` alanı ayrıca \`hidden\` olmalı.

## Yönetici test adımları
1. \`/admin.html\` oturum aç.
2. **Hydra Vitrin** bölümünde ana başlık ve kategori sırası değiştir; ana sayfayı yenile.
3. Ürün koduyla ara, kategori düzelt veya vitrine öne çıkar; kaydet.
4. Müşteri olarak ilgi listesine ürün ekle; teklif formunu test için yalnızca gerçek bir test e-postasıyla gönder.
5. **Teklif Talepleri** bölümünde talebi gör, durumunu \`İnceleniyor\` yap ve yönetici notu kaydet.
6. Mevcut ürün stoklarını ve tedarikçi bot kuyruğunu doğrula: bu sürüm onları değiştirmemelidir.
