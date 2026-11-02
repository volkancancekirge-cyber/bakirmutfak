# İzinli Ürün Kaynağı Botu — v0.1 (Sadece Ön İzleme)

**Durum:** Kod GitHub'da var, gerçek tedarikçi bağlantısı henüz yapılandırılmadı. Bu bot ürünleri mağazaya otomatik eklemez ve hiçbir görseli indirmez.

## Neden ön izleme ile başladık?
Henüz tedarikçi XML/API adresi ve kullanım iznimiz belli değil. Başka mağazalardaki fotoğraf, açıklama ve stok verisini izin almadan kopyalayıp mağazayı doldurmak hem yanlış ticari bilgiler oluşturabilir hem de içerik haklarını ihlal edebilir. Yetkili ürün kaynaklarından ilerliyoruz.

## Nasıl işleyecek?
1. Tedarikçi XML/API kaynağı ve bu veriyi kullanma izni doğrulanır.
2. GitHub repo **Settings > Secrets and variables > Actions** içinde iki özel secret girilir:
   - \`APPROVED_SUPPLIER_FEED_URL\`: güvenli HTTPS XML uç noktası (gizli token içeriyorsa URL'yi kamuya açık hiçbir yere yazma).
   - \`APPROVED_SUPPLIER_HOST\`: izinli tam alan adı.
3. GitHub Actions > **Approved supplier feed preview bot** > **Run workflow**.
4. Bot sadece kaynağı kontrol eder ve **toplam/geçerli/hatalı/görseli olan ürün sayısı** raporlar; ürün isim, fiyat veya XML içeriğini loglara yazmaz.
5. Ürünlerin oluşturulması/güncellenmesi ayrı onaylı işleme bağlanacaktır.

## Güvenlik
- HTTPS zorunludur; tek izinli hostname dışında istek yoktur.
- DNS sonrası private/loopback IP reddedilir, yönlendirme engellenir.
- 5MB ve 500 ürün sınırı; DTD/ENTITY reddedilir.
- Sıfır veritabanı yazma. Sıfır otomatik yayınlama.
- Bot tetikleme yalnızca manuel. Otomatik zamanlama, gerçek tedarikçi onayı olmadan eklenmeyecektir.
- XML alan isimleri şimdilik örnek Türkçe/İngilizce şemalara göre okunur; gerçek tedarikçi eşleştirmesi daha sonra yapılacaktır.
- GitHub Actions loglarında ürün fiyatları veya isimleri bulunmaz.

## Test
\`python -m unittest discover -s tools/tests -p 'test_supplier_preview.py' -v\`
\`python tools/supplier_preview_bot.py --fixture apps/storefront/public/samples/ornek-urunler.xml\`

Bu araç, tarayıcıdaki mevcut manuel XML ön izlemenin *yanında* çalışır; yetkili veri kaynağını kontrol etmek için kullanılacaktır.
