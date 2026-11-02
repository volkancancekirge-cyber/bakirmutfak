# BakırBul + The Coppery toplu katalog aktarımı

Kullanıcı, BakırBul ve The Coppery ürün fotoğrafları/katalog verilerini Bakır Mutfak'ta kullanmak için gerekli izne sahip olduğunu bildirdi.

## Mevcut durum
- Kod ve Supabase Edge Function: yayında.
- Kullanılan Edge Function: \`approved-catalog-bulk\`, JWT doğrulaması zorunlu.
- Yönetim paneli: \`admin.html\` > \`İnternetten Ürün Araştır\` > \`İki kaynağı tek seferde tara\`.
- Postgres \`bm_catalog_queue\`: kaynak URL'si, durum ve hata kayıtları; mükerrer URL yok.
- Postgres \`bm_product_candidates\`: yönetici incelemesi.
- Postgres \`bm_source_catalog\`: gerçek görselli ürünler için herkese açık, satın alınamayan katalog.
- \`bm_products\` ve gerçek satış/sipariş tablosu değiştirilmez.
- Görseller Supabase Storage \`bm-product-images/candidates/...\` içinde saklanır; görsellerin izinli ticari kullanım kapsamı kullanıcı sorumluluğundadır.
- Eksik fiyat ve stok için sahte rakam kullanılmaz.
- The Coppery kataloğunun 45 ürünü BakırBul üreticisine atfediliyor. SKU ya da aynı ad üzerinden diğer siteyle tekrar eşleştirmesi yapılıyor.

## İşlem
1. Mağaza sahibi hesabıyla giriş yap.
2. \`İnternetten Ürün Araştır\` ekranına git.
3. \`İki kataloğu keşfet ve içe aktar\` butonuna bas.
4. Sekme açıkken otomatik sitemap/kategori keşfi ve ürün işlemleri sırayla ilerler.
5. Görseli doğrulanan ürünler \`bm_source_catalog\` üzerinden \`/#/catalog\` ekranında gösterilir. **Fiyat ve sepet yoktur**.
6. İşlem yarıda kalırsa \`Kaldığı yerden devam et\` butonunu kullan; kuyruk veritabanında saklanır.
7. Tam kapsam doğrulaması için keşfedilen URL sayısını kaynak katalogdaki güncel ürün sayısıyla karşılaştır. Kategori sitemap erişimi engellenirse kaynakça eksik kalabilir.

## Güvenlik ve teknik sınırlar
- Yetkili kullanıcı JWT/Owner/Editor gereklidir; servis rolü anahtarı istemciye aktarılmaz.
- Yalnızca iki kayıtlı alan adında ürün URL'si kabul edilir.
- Redirect kapalıdır; HTML 1.5 MB, görsel 5 MB, en fazla 3 görsel/ürün.
- Görseller yalnızca desteklenen içerik türü ile dosya imzası uyuşuyorsa kopyalanır.
- Erişimi engellenen HTML sayfaları veya kaynak görseller içe alınmaz, loglanır.
- Kaynak kopyası yalnızca admin başlattığında çalışır; dış sitelere yük bindirmemek için küçük partiler halinde çalışır.
- İçe aktarılan sayfa verisinin tamamı, görüntü doğruluğu ve kaynak kapsamı gerçek kaynakta ayrı uçtan uca doğrulanmalıdır.

## Neden tek tık?
Supabase Edge Function yönetici JWT'si istiyor. ChatGPT bağlayıcısı Postgres migrasyonlarını çalıştırabiliyor, ancak tarayıcının yönetici oturum belirtecini görmüyor. Bu yüzden dış sitelerden sunucu tarafında fotoğraf kopyalama işlemini kullanıcı kendi oturumundan başlatıyor. JWT veya şifreyi sohbette istemiyoruz.
