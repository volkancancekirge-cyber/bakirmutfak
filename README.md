# Bakır Mutfak — Signature Hibrit

> Aşama: Bagisto 2.5 tema entegrasyonu. Bu depo **tek başına çalışan Laravel mağazası değildir**. Canlı site, gerçek ödeme ve sipariş henüz yoktur.

## Hazırlananlar
- Özgün ana sayfa hero, koleksiyonlar ve Bagisto API'sinden ürün seçkisi.
- Bagisto kategori görünümünde gerçek ürün arama, filtreleme ve sıralama kodu korunur.
- Bagisto ürün detay sayfasında gerçek varyant, stok ve sepet bileşenleri korunur.
- Tüm sayfalarda Signature tipografi ve bakır tonlarında stil dosyası.
- Bagisto 2.5 kaynaklarının üzerine otomatik tema uygulama aracı ve GitHub Actions temel kontrolleri.

## Entegrasyon
1. Resmî Bagisto 2.5 kaynaklarını kur: https://github.com/bagisto/bagisto/tree/2.5
2. Bu depoyu ve temiz Bagisto kaynağını aynı çalışma ortamına al.
3. Temayı uygula: `php tools/install-theme.php /path/to/bagisto`
4. Bagisto içinde `php artisan optimize:clear` çalıştır; admin panelinde ilgili kanalın teması olarak `Bakır Mutfak Signature` seç.
5. Türkçe, TRY, gerçek ürünler, stok, ödeme/kargo ayarları ve SEO verilerini yönetim panelinden tamamla.

Tema Bagisto'nun **default Vite/Vue derlemesini ve alışveriş çekirdeğini korur**. Bu repo ödeme altyapısını veya canlı sunucuyu otomatik oluşturmaz. GitHub Actions sadece kopyalama ve PHP syntax doğrulaması yapar, runtime/e2e testi değildir.

## Güvenlik ve yayın
Depo **public**. Gizli şifre, APP_KEY, DB erişimi ve ödeme anahtarı eklemeyin. Ayrı PHP hosting, veritabanı, kalıcı görsel depolama, HTTPS ve domain yetkisi gerekir. Önce staging, ardından gerçek ödeme testi ve üretim yayını.

## Referanslar
- https://devdocs.bagisto.com/theme-development/creating-store-theme.html
- https://devdocs.bagisto.com/2.x/themes/
- https://github.com/bagisto/bagisto/tree/2.5
## Yeni: XML, görseller, stok ve fiyat aktarımı
- [XML normalizasyonu ve güvenlik politikası](docs/XML-IMPORT.md): tedarikçi XML alanlarını Bagisto Data Transfer CSV'ye dönüştürme.
- [Bulut yayın hazırlığı](docs/CLOUD-DEPLOY.md): hazır Bagisto Docker imajı, yerel Vite/Vue kurulumu gerektirmez.
- [Yönetim paneli mimarisi](docs/ADMIN-SYSTEM.md): panelin mevcut özellikleri ve geliştirilecek tedarikçi merkezi.
- GitHub Actions: **XML Import Safety** ve **Signature Theme Integration** otomatik testleri.

Gerçek tedarikçi XML'i olmadan sadece örnek eşleştirme test edildi; yönetim panelinde tek tık XML senkronizasyonu henüz yoktur.
