# Bakır Mutfak — güçlü yönetim sistemi tasarımı

## Halihazırda Bagisto ile gelen çekirdek
- Ürün, kategori, özellik aileleri, ürün varyantları ve birden çok stok kaynağı.
- Sipariş, fatura, sevkiyat, iade, kupon ve kampanya kuralları.
- Müşteri hesapları/grupları, yönetici rolleri ve yetki kontrolleri.
- Veri aktarımı: CSV, XLS, XLSX, XML. Batch validasyonu, hata raporu ve URL görsellerinin indirilmesi.
- Raporlama, CMS/tema ve çeşitli para birimi/dil/kanal ayarları.

## Özel XML tedarikçi merkezi — geliştirilecek (henüz yok)
- Tedarikçi listesi (XML adresi, şema eşleştirme, zamanlama, durum).
- XML yükle / URL bağla -> SKU, stok, maliyet ve satış fiyatı, kategori, fotoğraf önizlemesi.
- Hangi kayıtlar yeni/değişmiş/hatalı? Diff ve değişim eşiği uyarısı.
- Güvenli onay: önce dry-run, ardından onaylı batch; otomatik silme varsayılan kapalı.
- Yetkilendirilmiş iş akışı, audit log, job retry, başarılı/hatalı senkronizasyon geçmişi.
- 5.000+ ürün ve çoklu tedarikçi için kuyruklu parçalara bölme, kilitleme ve kaynakta tutarlılık.

## Güvenlik ve operasyon
- Ortam sırları Railway Secrets/Variables'da; asla GitHub'a veya XML preview URL'lerine konmaz.
- Hesaplar için 2FA, asgari rol yetkileri, admin oturum güvenliği, import URL allowlist.
- Tedarikçi URL'lerinin güvenlik taraması; dış HTTP isteklerinde SSRF ve yönlendirme kontrolleri.
- Ödeme bildirimlerinde imza doğrulama, idempotency ve stok rezervasyonu.
- Veritabanı yedekleri, geri yükleme testi, medya yedeği, hata izlemesi ve günlükler.
- CI ile statik test, daha sonra Laravel entegrasyon testleri ve gerçek tarayıcı E2E.

## Ne tamamlandı?
- Çalışan tek tık XML admin paneli henüz yok.
- Hazır Bagisto yönetim sistemi incelendi; güvenli XML feed dönüştürücü ve bulut CI testleri GitHub'a eklendi.
- Domain/hosting/gerçek ürün/ödeme henüz bağlanmadı.
