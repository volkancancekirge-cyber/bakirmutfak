# Bakır Mutfak — XML aktarımı

Bu modül, tedarikçinin farklı XML alanlarını **kontrol edilip yöneticinin onayına sunulabilen** Bagisto 2.5 CSV dosyasına dönüştürür. Gerçek mağaza kurulana kadar otomatik içe aktarma ve tedarikçi senkronizasyonu etkin değildir.

## Veri akışı

Tedarikçi XML -> eşleştirme JSON -> ön izleme / doğrulama -> CSV -> Bagisto Yönetim > Settings > Data Transfer > Imports -> Products > Create/Update > Stop on errors -> Image links -> stok / fiyat indeksleme.

Bagisto'nun kendi ithalat altyapısı CSV, XLSX ve **XML** de alır. Standart XML'de her ürün satırının değerleri XML öznitelikleri (attributes) olmalıdır; iç içe tedarikçi XML'i için bu dönüştürücü gerekir.

## Hazırlanan güvenlik
- Hatalı fiyat, eksik stok/SKU, tekrar eden SKU, uygunsuz görsel URL'sinde import dosyası oluşturulmaz.
- XML DOCTYPE/XXE reddedilir. 25 MB dosya / 5000 ürün / 1 MB ürün sınırı.
- Görseller yalnızca HTTPS URL olarak CSV'ye aktarılır; downloader native Bagisto importer'dır.
- Silme işlemi yok; varsayılan `publish:false` ile ürünler onay olmadan yayına çıkmaz.
- XML ve URL'ler public GitHub'a eklenmemeli; tedarikçi anahtarları gizli tutulmalı.

## Bulut ortamında kullanım

```bash
php tools/xml-to-bagisto.php fixtures/ornek-urunler.xml /tmp/urunler.csv config/tedarikci-ornek.json --dry-run
php tools/xml-to-bagisto.php fixtures/ornek-urunler.xml /tmp/urunler.csv config/tedarikci-ornek.json
```

Kullanıcının bilgisayarına Vite, Vue, PHP veya diğer yazılımlar kurulmaz; bunları hazırlama/test etme işlemleri GitHub Actions ve hosting ortamında yapılır.

## Tamamlanması gerekenler
Gerçek XML formatına göre mapping, yönetim paneline özel yükle/önizle/onay ekranı, çalışacak sunucu, fiyat değişimi alarmı, kalıcı audit log, otomatik feed/cron, URL geçmişi ve gerçek veritabanı testleri **henüz yapılmadı**.
