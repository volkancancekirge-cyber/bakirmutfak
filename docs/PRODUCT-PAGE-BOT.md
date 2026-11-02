# İnternetten Ürün Araştırma Botu — HTML/JSON-LD ön izleme

XML beklemeden ürün adaylarını araştırmak için hazırlanmıştır. Yönetim panelindeki **İnternetten Ürün Araştır** sekmesi, gerçek üretici ve toptancı adaylarını kaynaklarıyla birlikte listeler. Varsayılan olarak hepsi **izin bekliyor** durumundadır.

Bu Python botu izinli bir ürün sayfasındaki schema.org \`Product\` / \`Offer\` yapılandırılmış verisini okuyabilir. Robots.txt ve HTTPS host izin listesi kontrol edilir. Sadece sayıları raporlar; ne görselleri indirir ne de ürün, stok ve fiyatları bizim ticari kataloğumuza ekler.

## Örnek test
\`python tools/product_page_bot.py --fixture tools/fixtures/product-page-demo.html\`

## Gerçek kaynak için
1. Gerçek üretici/tedarikçiyle ürün verilerini ve fotoğraflarını mağazamızda tekrar kullanma yetkisi teyit edilir.
2. Sayfanın robots.txt kuralları otomatik erişime izin vermelidir.
3. \`APPROVED_PRODUCT_HOST\` güvenli secret değişkeni üzerinden tedarikçi host adı girilir.
4. Kod, onaylanmış URL için \`python tools/product_page_bot.py --url https://... \` çağrısıyla **yalnızca ön izleme** yapar.
5. Ürünlerin yayına alınması için gerçek SKU, alış fiyatı/satış fiyatı, stok, teslimat koşulları ve görsel kullanım hakkı kontrol edilir.

**Kritik:** Bulduğumuz 4 B2B adaydan henüz ürün verisi kullanım izni alınmış değildir. İnternette bulmak, ürününü otomatik satma veya fotoğrafını kopyalama hakkı vermez. XML/API olmadan da teknik entegrasyon mümkündür, ancak kaynağa erişim ve ticari kullanım izni gereklidir.
