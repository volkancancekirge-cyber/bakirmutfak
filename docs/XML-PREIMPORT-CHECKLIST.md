# Bakır Mutfak — XML gelmeden önce son kontrol / 3 Kasım 2026

## Durum

XML, mağazaya **henüz aktarılmadı**. İki kaynakta önceden bulunan gerçek görselli ürünler korunmaktadır. Hydra Admin > **XML Tedarikçiler** sayfası, içerik şemasını ve ilk 5000 kaydın doğrulanabilirliğini görmek için **yalnızca okuma modundadır**.

Bu adım özellikle istenmiştir: tedarikçi XML dosyası gerçek ürün verisi olarak alınmadan önce sistem, filtreler, fotoğraflar, fiyat, stok ve mükerrer kayıtlarla uyumlu hâle getirilecek.

## Hazırlanan ön denetimler

1. **XML yapısı:** kök etiket, tekrar eden satır etiketi, olası alanlar; standart Urun/Product/item etiketlerinin okunması. Kişisel/özel veriler tarayıcıdan gönderilmez.
2. **Veri kontrolleri:** ürün kodu formatı, benzersizlik, ürün adı, TRY fiyat biçimi, stok sınırı, resim URL'si, görselsiz ürün ve hata listesi.
3. **Mevcut katalog eşleştirmesi:** BakırBul/The Coppery kaynak kayıtlarında SKU eşleşmesi, tam isim benzerliği, eski manuel ürünlerle SKU çakışması, mevcut manuel fiyatlarda %30'u aşan fark.
4. **CSV ön izleme:** Excel formül enjeksiyonlarını nötralize ederek indirme.
5. **15 MB ve 5000 kayıt sınırı:** yalnızca yerel tarayıcı ön izlemesi; büyük dosya gerekirse ayrı güvenli sunucu işlemi hazırlanmalı.
6. **Veritabanı yazma kapalı:** XML ön izlemede içe aktarma düğmesi kilitli. Fiyat/stoğa dokunulmaz.

## XML'i aktarmadan önce yapılacaklar

- **Gerçek tedarikçi dosyasını incele:** XML dosyası, bağlantı veya şemasını user-provided güvenli dosya olarak sohbete yükle. URL içinde özel erişim anahtarı varsa konuşmaya açık URL koyma.
- Alanları net eşleştir: SKU, ürün adı, satış fiyatı, stok, açıklama, fotoğraf, varsa varyant, EAN, KDV, para birimi ve kategori.
- Satış fiyatı ile alış maliyetini ayırt et; KDV dahil/hariç fiyatı teyit et. Kaynakta yalnızca maliyet varsa otomatik satış fiyatına dönüştürme.
- 711 katalog kaydına karşı SKU/isim/üretici eşleştirmesini test et. Aynı ürünü farklı SKU ile çoğaltma; el ile yapılmış düzeltmeleri ve fotoğrafları koru.
- İlk küçük grupta test (örneğin 10 kayıt), sonra parça başına 500 kayıt sınırına uygun server-side aktarım ve denetim raporu.
- Beklenmeyen fiyat hareketleri, düşen stoklar ve kaybolan ürünler için güvenli önizleme ve açık yönetici onayı.
- Manuel taslaklar ve tanıtım ürünleri aktarım sonucu otomatik yayımlanmayacak. Gerçek sipariş, ödeme, kargo bu aşamada hâlâ kapalı.

## Yönetici kaydetme ve navigasyon düzeltmesi

- Sayfa adresi \`/admin.html#/hydra\`, \`#/xml\`, \`#/products\` gibi seçili sekmeyi gösterir.
- Yenileme, geri/ileri ve oturum aynı sekmeyi korur; XML dosyasının **içeriği** güvenlik gerekçesiyle yenilemeden sonra tekrar seçilmelidir.
- Kaydetme yalnızca Supabase'de gerçekten yazılan kayıt döndürülürse ve veriler yeniden okunduğunda aynıysa başarılı sayılır. Boş yanıt, yetki engeli ve uyumsuz veri hata olarak gösterilir.
- Yönetici ve kaydedilen ayarlar için tarayıcıda gerçek oturum açmış bir kullanıcının tekrar doğrulaması önerilir; GitHub testleri yanıltıcı sıfır-satır kayıt yanıtını da sınar.

## Mevcut gerçek veri

Başlangıçta Supabase'de 711 görünür kaynak katalog ürünü, 1 eski manuel ürün, 1 Hydra ayar kaydı ve 0 kayıtlı vitrin ürün tercihi mevcuttu. Yeni XML aktarımı hiç çalıştırılmadı.

## Sınırlar

- Hazırlanan parser yalnızca genel alan adlarını tanıyor; gerçek tedarikçi XML şeması olmadan kesin uyumluluk sözü verilemez.
- Mevcut backend XML RPC'si bir defada en çok 500 kayıt işler; 500+ kayıtların tamamının atomik aktarımı ve geri dönüş (rollback) planı gerçek dosya görüldükten sonra yapılmalıdır.
- E-ticaret site yayını halen ön izleme ortamıdır; ödeme ve satış henüz açık değildir.
