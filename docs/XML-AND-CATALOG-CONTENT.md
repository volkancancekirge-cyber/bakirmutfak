# Bakır Mutfak — XML yükleme ve ürün açıklamaları

## 1. Yardımcı Bakır XML dosyasını nasıl inceleyeceğiz?
1. https://bakirmutfak.vercel.app/admin.html#/xml adresine gir ve yönetici oturumunu aç.
2. **XML dosyası seç** ile Yardımcı Bakır'dan gelen \`yardimcibakir.com.tr.xml\` dosyasını seç.
3. **Ön izleme** ekranında ana ürün kartını, varyasyonları, SKU tekrarlarını, pasif varyasyonları, görselleri, stok ve KDV uyarılarını incele. Bu adım tarayıcıda çalışır; XML dosyası DB'ye yazılmaz.
4. İhtiyaç varsa **CSV ön izlemeyi indir** ile değerlendirme raporu al.
5. **İçe aktarma düğmesi bilinçli olarak kilitli.** Önceki taahhüt gereği, açık onay olmadan yeni tedarikçi ürünleri veritabanına aktarılmaz.

## 2. Neden bir seferde \"Yükle\" demiyoruz?
Bu XML 168 ana ürün kartında 925 varyasyon içeriyor. Ana ürün ve varyasyonu ayırmalıyız; tek stok kodu tekrarlanan seçenekler var. Kaynakta \`KDVDahil=false\`, \`KdvOrani=20\`, \`ParaBirimiKodu=TRY\`; bu değerler mağazadaki gerçek fiyat politikasının yerine geçmez. Çok yüksek görünen stokların anlamı ve 0,00 maliyetler tedarikçiden teyit edilmelidir. Bazı varyasyon görselleri boş; ürün ailesinin görselleriyle eşleştirilmeli.

**Sonraki gerçek aktarım sırası:** (a) yeni tedarikçi kimliği, (b) ana ürün + varyasyon şeması ve kaynak SKU eşleştirme, (c) mükerrer/pasif kayıt engelleme, (d) görsel/ölçü/KDV/stok kontrolü, (e) 10 kayıtlık taslak deneme, (f) denetim raporu/geri dönüş planı, (g) yönetici onayı ile kalan kayıtlar, (h) ayrı fiyat ve stok onayı ile satışa açma. Sistem şu anda yalnızca (a-d) ön inceleme aşamasındadır.

## 3. Mevcut 711 BakırBul ürününün açıklamaları

Hydra artık her ürün detay sayfasında ürünün kendi ismi, SKU'su, adından açıkça okunabilen ölçü, yüzey rengi, işçilik ipuçları ve kategoriye özel seçim rehberi gösterir. Bunlar **doğrulanmış üretici teknik verisi olarak sunulmaz**.

Üreticiden kaynaklı gerçek bir açıklamayı onaylamak için:
1. https://bakirmutfak.vercel.app/admin.html#/content sayfasını aç.
2. Ürün adı veya SKU ile ürünü bul, **Ürünün tedarikçi sayfasını aç** bağlantısını kullan.
3. Doğrulanmış ölçü, model, üretim, yüzey, kaplama, bakım vb. bilgileri kendi sözlerinle açıklama alanına yaz. Teknik özellikleri her satırda \`Özellik: Değer\` biçiminde gir.
4. **Taslak kaydet** ile yalnızca yönetici tarafında sakla. **Bu açıklamadaki teknik iddiaları kaynakta kontrol ettim** işaretleyip **Kontrol ettim, yayımla** ile ürün detayında göster.
5. Yazma işlemi DB'den tekrar okunarak doğrulanır. Onay işlemi fiyat/stoğu veya sipariş sistemini açmaz.

**İçerik kaynağı** \`supplier_page\`, \`supplier_document\`, \`manual_review\` olarak saklanır. \`bm_product_content\` tablosu RLS ile korunur: onaysız taslaklar halka açık API'den okunamaz. Ön inceleme ürün bilgisini kopyalamak, gerçek fiyat, stok ve ürün sertifikalarının doğrulandığı anlamına gelmez.

## 4. Ticari açılış öncesi güvenlik kapıları
- Her ürün için gerçek satış fiyatı, vergi dahil/hariç politikası, güncel tedarik, garanti/iade şartları, ürün güvenliği ve gıda temasına uygunluk teyidi.
- KVKK aydınlatma, e-ticaret hukuki metinleri, iletişim/şirket bilgileri, ödeme ve sipariş entegrasyonu.
- Üreticiden gelen teknik özellikleri sosyal medya veya arama sonuçlarından tahmin ederek doldurma. Verinin kaynağını ve son doğrulama tarihini saklama; değişen tedarikçi ürünlerini tekrar gözden geçirme.
- \`bm_product_content\` yalnızca **ürün detay metni** için kullanılır; yayın durumunu, fiyatı, stoğu veya XML içe aktarımını değiştirmez.
