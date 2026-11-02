# Bakır Mutfak — BakırBul / The Coppery görsel aktarımı

Bu entegrasyon **yalnızca mevcut Owner/Editor yönetici oturumuyla** açılır. İzinli kaynakları Supabase'deki \`bm_research_sources\` tablosundaki \`rights_status = approved\` kaydından kontrol eder.

## Kullanım
1. https://bakirmutfak.vercel.app/admin.html adresinde oturum aç.
2. **İnternetten Ürün Araştır** sekmesini aç.
3. **İzinli ürün fotoğrafları** bölümündeki BakırBul veya The Coppery örnek ürününü seç veya **tekil ürün sayfası** adresini gir.
4. **Görselleri bul**: Kaynak HTML ürün sayfasından JSON-LD/OG görselleri aranır. Kopyalama henüz yoktur.
5. Fotoğrafları seçip **Seçilen fotoğrafları Supabase’e kopyala** seçeneğini onayla.
6. Fotoğraflar \`bm-product-images/candidates/... \` klasörüne yazılır, \`bm_product_candidates\` inceleme tablosuna kaydedilir.
7. Durum **İnceleme bekliyor**; yönetici **Görseller onaylandı** olarak işaretleyebilir. Bu işlem gerçek ürün tablosunu veya fiyatları değiştirmez.

## Veri ve izin politikası
- BakırBul ve The Coppery panelde **izin alındı** olarak işaretli olsa da bu, bir satış veya stok teyidi değildir.
- The Coppery'nin pek çok ürünü BakırBul üretici kataloğuna aittir; aynı SKU ikinci kez içe alınmaz.
- Yalnızca \`bakirbul.com/urun/...\` ve \`thecoppery.com/tr/urun/...\` sayfaları kabul edilir.
- Dış kaynaklardan fotoğraf ve HTML alırken HTTPS, sabit host, no redirect, 1.5 MB HTML, 5 MB görsel ve maksimum 4 görsel/işlem sınırı var.
- Görseller JPEG, PNG ve WebP içerik türü ve dosya imzasıyla doğrulanır; HTML, SVG, AVIF, EXE kabul edilmez.
- Endpoint, Supabase JWT ve admin RLS gerektirir; yalnızca siteye ait browser origin kabul edilir.
- Tüm adaylar inceleme tablosundadır. Yeni satış ürünü oluşturulmaz, fiyat/stoğa dokunulmaz.
- Sadece incelenmiş, kullanma izni bulunan görseller aktarılsın. Yüklenen görseller kamusal Supabase Storage adresinden erişilebilir.
- Ürün kaynak sayfası robots.txt veya engelleyici sunucu davranışı nedeniyle ulaşılamazsa işlemi zorlamayın; izinli XML/API/fotoğraf paketi kullanın.

## Eksikler ve sonraki aşama
- Gerçek tarayıcıda yönetici JWT ile kaynak sayfası ön izleme ve Storage kopyalama uçtan uca henüz doğrulanmadı.
- Kaynak sayfalarının HTML/URL şeması değişebilir; hiç görsel bulunamadığında uygulama sessizce alternatif görsel seçmez.
- Görsel adayını gerçek ürünle ilişkilendirme, dosya silme/orphan cleanup, otomatik zamanlama, stok ve tedarikçi fiyat entegrasyonu daha sonra yapılacak.
- Tedarikçi görsellerini otomatik yayımlama yoktur.

## Örnek ürün bağlantıları
- https://bakirbul.com/urun/eylul-cezve-1-no-2-fincan-makine-dovme-kirmizi-bb1227-1/
- https://thecoppery.com/tr/urun/bakirbul-klasik-caydanlik-2-no-kalin-el-dovme-kirmizi-bb1951-1
