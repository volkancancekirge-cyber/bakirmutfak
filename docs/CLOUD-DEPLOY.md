# Bakır Mutfak — kurulum gerektirmeyen bulut hazırlığı

## Bilgisayarda kurulum
Yok. Dockerfile, Bagisto 2.5.0 resmî image'ındaki PHP 8.4 / Vue / Vite derlenmiş varlıklarını kullanır. Railway, GitHub deposundan cloud Docker build yapabilir.

## Hedef mimari
- Web: Bagisto 2.5.0, Nginx ve PHP 8.4, Signature tema.
- Veritabanı: Railway yönetimli kalıcı MySQL, private network.
- Medya: Kalıcı volume veya S3 / R2 dosya depolama.
- Queue / scheduler: Resmî imajda Supervisor ve Laravel scheduler.
- XML: Bagisto native Data Transfer, SKU ile create/update ve resim indirme; tedarikçi yapısı farklıysa XML normalizasyon modülü.

## İnternete açılmadan önce zorunlu güvenlik kontrolleri
1. Railway hesap bağlantısı / hosting yetkisi.
2. Harici MySQL bilgileri: DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD.
3. APP_KEY, APP_URL, APP_ENV=production, APP_DEBUG=false ve PORT=80 gizli/runtime değişkenleri.
4. Boş harici veritabanına migrate/seed, güvenli ve benzersiz admin şifresi; resmî Bagisto imajında gelen varsayılan admin hesabıyla mağaza asla internete açılmaz.
5. Kalıcı medya depolama, veritabanı ve medya yedekleri, geri alma prosedürü.
6. Türkçe ve TRY, vergiler, fatura/kargo, yasal sayfalar, ödeme sandbox testleri.
7. Gerçek browser E2E: kullanıcı, filtre, varyant, sepet, stok, ödeme, iade.
8. Domain DNS, SSL ve proxy/HTTPS doğrulaması.

## Önemli teknik not
Resmî Bagisto Docker image, kendi dahili veritabanıyla demo kurulumlu gelir; harici boş MySQL kullanıldığında migrate ve seed ayrı yürütülür. Dockerfile şu an GitHub'da sadece cloud image build altyapısıdır; canlı uygulama kurulmadı, Docker runtime çalıştırma ve Railway deploy henüz test edilmedi.

## Referans
https://github.com/bagisto/bagisto/blob/2.5/docker/production/README.md
https://docs.railway.com/builds/dockerfiles
