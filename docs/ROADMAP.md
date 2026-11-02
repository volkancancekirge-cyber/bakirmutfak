# Bakır Mutfak yayınlama yol haritası

## Şimdi
- [x] Signature Hibrit tasarım yönü ve üç ekran prototipi
- [x] Bagisto 2.5 ana sayfa, kategori, ürün detay ve genel layout theme override
- [x] Mobil CSS, yeniden uygulanabilir tema script'i, statik CI
- [ ] Tam Bagisto uygulaması ile Laravel + Vue runtime testi
- [ ] Yönetim panelinden gerçek ürün, fotoğraf, KDV, stok ve özellikler
- [ ] Kullanıcı hesabı, filtreleme, varyant, sepet, kargo ve sipariş uçtan uca testi
- [ ] Railway/Laravel Cloud staging: PHP, DB, APP_KEY, mail, kuyruk, medya ve yedekleme
- [ ] PayTR/iyzico test entegrasyonu, webhooks, ödeme ve stok tutarlılığı
- [ ] KVKK/ETBİS, satıcı bilgileri, iade/mesafeli satış, Search Console, ürün şema verileri
- [ ] Alan adı/DNS/SSL ve production release

Bagisto kaynak sürümü 2.5 branch commit 2021548672bbece5caf39bded96b90cabacfd973 üzerinden alındı. Üst sürümlerde override diff'leri incelenmelidir.

Dikkat: bu repo uygulama yerine uygulanabilir tema değişikliklerini içerir; dağıtıma hazır canlı Laravel uygulaması değildir.
## XML ve bulut ilerlemesi
- [x] Tedarikçi XML -> Bagisto CSV normalizasyonu; fiyat/stok/SKU/görsel HTTPS validasyonu.
- [x] GitHub Actions bulut XML testleri.
- [x] Derlenmiş Bagisto temel imajından Dockerfile (kullanıcının cihazında Vite/Composer gerekmez).
- [ ] Gerçek supplier XML örneğiyle alan eşleştirme ve kategori/varyant yapısı.
- [ ] Yönetim panelinde XML yükleme, önizleme, onay, işlem geçmişi ve zamanlama.
- [ ] Harici DB bağlantısı, admin ilk kurulum, kalıcı storage, staging testleri ve hosting dağıtımı.
