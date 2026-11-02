# Bakır Mutfak · Ürün düzenleme ve görsel yükleme (geliştirme)

Supabase Free projesinde \`bm-product-images\` herkese okunabilir Storage bucket'ı kuruldu.
- Ürün görselleri: JPEG, PNG, WebP; dosya başına max 5 MB.
- Yükleme yalnızca \`authenticated\` role + private \`bm_is_admin()\` yetkisi ile.
- Ürün düzenleme: başlık, SKU (mevcut ürünlerde kilitli), fiyat, stok, kategori, tür, açıklama, malzeme, rozet, ölçü, el işçiliği, kalaylı, 8 fotoğraf.
- Ürün düzenleme \`PATCH\` ile kaydedilir, slug ve yayında olma durumu otomatik değişmez.
- Yeni ürünler \`published=false\` başlar. Mevcut ürünler silinmez.
- İçe aktarma için gerçek XML gerekli değil; örnek XML indirme mevcut. Bu örnek ürünler gerçek ürün olarak kabul edilmemeli.
- Yayımlanmış fotoğraflar herkese görünür; özel stok/tedarikçi fiyat dosyaları buraya yüklenmemeli.

**Açık işler:** Orphan media cleanup ve resim silme; versiyonlu fiyat/stok audit log; gerçek tedarikçi XML alan eşleme; otomatik senkronizasyon; tam tarayıcı E2E; gerçek satış.
