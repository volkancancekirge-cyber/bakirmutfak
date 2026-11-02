<x-admin::layouts>
    <x-slot:title>Bakır Mutfak · XML Ürün Kontrolü</x-slot:title>

    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
            <p class="text-xs font-semibold uppercase tracking-widest text-amber-700">BAKIR MUTFAK · YÖNETİM</p>
            <h1 class="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">XML ürün aktarımı</h1>
            <p class="mt-1 text-sm text-gray-500 dark:text-gray-300">Önce ürünleri doğrula. Onay vermeden ürünler ve fiyatlar değişmez.</p>
        </div>
        <a href="{{ route('admin.settings.data_transfer.imports.index') }}" class="secondary-button">Bagisto İçe Aktarmalar</a>
    </div>

    <div class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div class="mb-5 flex items-center gap-3">
            <span class="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-amber-800">01</span>
            <div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Tedarikçi XML dosyasını yükle</h2>
                <p class="text-sm text-gray-500">En fazla 25 MB. Alan eşleştirmesi mevcut örnek tedarikçi profiline göredir.</p>
            </div>
        </div>

        <form method="POST" action="{{ route('admin.bakirmutfak.xml.preview') }}" enctype="multipart/form-data" class="space-y-4">
            @csrf
            <label for="bm-xml-file" class="block text-sm font-medium text-gray-700 dark:text-gray-200">XML ürün dosyası</label>
            <input id="bm-xml-file" type="file" name="feed" accept=".xml,application/xml,text/xml" required
                   class="block w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 dark:bg-gray-800 dark:text-white">
            @error('feed')
                <p role="alert" class="text-sm text-red-600">{{ $message }}</p>
            @enderror
            <button type="submit" class="primary-button">Dosyayı doğrula ve ön izle</button>
        </form>
    </div>

    @if (! empty($error))
        <div role="alert" class="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {{ $error }}
        </div>
    @endif

    @if (is_array($report))
        <section aria-label="XML ön izleme sonucu" class="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-900">
            <div class="mb-5 flex flex-wrap gap-4">
                <div><p class="text-xs text-gray-500">Okunan ürün</p><p class="text-2xl font-bold">{{ $report['total'] ?? 0 }}</p></div>
                <div><p class="text-xs text-gray-500">Geçerli ürün</p><p class="text-2xl font-bold">{{ $report['valid'] ?? 0 }}</p></div>
                <div><p class="text-xs text-gray-500">Hatalı ürün</p><p class="text-2xl font-bold">{{ $report['invalid'] ?? 0 }}</p></div>
                <div><p class="text-xs text-gray-500">Görseli eksik</p><p class="text-2xl font-bold">{{ $report['missing_images'] ?? 0 }}</p></div>
            </div>

            @if (! empty($report['errors']))
                <h3 class="mb-3 font-semibold">Düzeltilmesi gereken hatalar</h3>
                <ul class="mb-5 list-disc space-y-2 pl-6 text-sm text-red-700">
                    @foreach ($report['errors'] as $item)
                        <li>Satır {{ $item['item'] ?? '?' }}: {{ $item['error'] ?? 'Geçersiz değer' }}</li>
                    @endforeach
                </ul>
            @endif

            @if (! empty($report['preview']))
                <div class="overflow-x-auto">
                    <table class="w-full border-collapse text-left text-sm">
                        <thead><tr class="border-b border-gray-200 text-gray-500"><th class="p-3">SKU</th><th class="p-3">Ürün</th><th class="p-3">Fiyat (TRY)</th><th class="p-3">Stok</th><th class="p-3">Durum</th></tr></thead>
                        <tbody>
                        @foreach ($report['preview'] as $item)
                            <tr class="border-b border-gray-100 dark:border-gray-700">
                                <td class="p-3">{{ $item['sku'] }}</td>
                                <td class="p-3">{{ $item['name'] }}</td>
                                <td class="p-3">{{ $item['price'] }}</td>
                                <td class="p-3">{{ $item['stock'] }}</td>
                                <td class="p-3">{{ ($item['status'] ?? '0') === '1' ? 'Aktif' : 'Onay bekliyor' }}</td>
                            </tr>
                        @endforeach
                        </tbody>
                    </table>
                </div>
            @endif

            @if ($token)
                <div class="mt-6 flex flex-wrap items-center gap-4 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
                    <span>Doğrulama başarılı. Ürünler henüz kaydedilmedi. Dosya 30 dakika içinde indirilebilir.</span>
                    <a class="primary-button" href="{{ route('admin.bakirmutfak.xml.download', $token) }}">Bagisto CSV dosyasını indir</a>
                </div>
            @endif
        </section>
    @endif

    <div class="mt-5 rounded-lg bg-gray-100 p-4 text-sm text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        <strong>Güvenli iş akışı:</strong> İndirilen CSV'yi Bagisto İçe Aktarmalar bölümünde önce durdurma stratejisiyle doğrulayın.
        Bu ekran tek başına sipariş, fiyat veya stok kaydı değiştirmez.
    </div>
</x-admin::layouts>
