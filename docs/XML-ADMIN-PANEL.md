# XML Yönetim Ekranı — Bakır Mutfak

## 1. Yönetici iş akışı
- Bagisto yönetimine giriş yap (2FA/ACL korunur).
- Ayarlar > Veri Aktarımı > Bakır Mutfak XML sayfasını aç.
- XML dosyasını seç. Yükleme üst sınırı 25 MB.
- XML verisi sunucuda geçici alanda doğrulanır. Hatalı fiyat, stok, SKU, XML veya URL bulunan besleme tamamen reddedilir.
- Doğrulanan satırların ön izlemesini gör. Varsayılan ürün durumu **pasif**.
- CSV dosyasını 30 dakika içinde indir. Link yalnızca aynı yönetici oturumu için geçerli ve bir kez kullanılabilir.
- Bagisto > Data Transfer > Imports bölümünden dosyayı **stop on errors** ile ayrı olarak içe aktar.

## 2. Güvenlik
- Laravel oturum, CSRF, Bagisto admin middleware ve Bagisto ACL ile korunur.
- Upload dosyası özel storage alanında tutulur; input dosyası işlem sonunda silinir.
- CSV geçici özel dosyadır, indirme sonrası silinir.
- Hiçbir ürün ön izleme esnasında değiştirilmez ve tedarikçi URL'sinden sunucuya otomatik dosya çekilmez.
- Süresi dolan ve indirilmeyen geçici dosyaların periyodik temizliği henüz eklenmedi: operasyon kontrolü gerekir.
- Üretimde anahtarlar, XML tedarikçi erişim bilgileri ve müşteri verileri GitHub'a yüklenmez.
- Bu ekran varsayılan **örnek mapping** içindir; gerçek tedarikçi XML şeması bilinmeden ürünlere uygulanmamalı.
- Mevcut sistem yalnızca düz simple ürünleri işler; varyant, kategori eşleme ve fiyat değişimi onayı sonraki fazdır.

## 3. Durum
Tema installer aracı extension provider kaydını ekler ve UI dosyalarını Bagisto içine kopyalar.
GitHub Actions yalnızca PHP sentaks ve idempotent kurulum testi yapar; gerçek DB+tarayıcı testleri staging kurulunca yapılacak.
