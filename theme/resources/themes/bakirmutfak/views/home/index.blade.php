@php
    $channel = core()->getCurrentChannel();
@endphp

<!-- SEO Meta Content -->
@push ('meta')
    <meta
        name="title"
        content="{{ $channel->home_seo['meta_title'] ?? '' }}"
    />

    <meta
        name="description"
        content="{{ $channel->home_seo['meta_description'] ?? '' }}"
    />

    <meta
        name="keywords"
        content="{{ $channel->home_seo['meta_keywords'] ?? '' }}"
    />
@endPush

@push ('scripts')
    @if (! empty($categories))
        <script>
            localStorage.setItem('categories:{{ $channel->code }}:{{ app()->getLocale() }}', JSON.stringify(@json($categories)));
        </script>
    @endif
@endPush

<x-shop::layouts>
    <!-- Page Title -->
    <x-slot:title>
        {{ $channel->home_seo['meta_title'] ?? '' }}
    </x-slot>


    <section class="bm-hero">
      <div class="bm-hero-copy">
        <span class="bm-eyebrow">BAKIR MUTFAK · SIGNATURE COLLECTION</span>
        <h1>Zanaatin sıcaklığı.<br><em>Her sofrada.</em></h1>
        <p>Gelenekten ilham alan bakır mutfak ürünleriyle tanışın. Zamansız dokunuşlar, günlük ritüeller.</p>
        <div class="bm-hero-actions"><a class="bm-button" href="{{ route('shop.search.index') }}">Koleksiyonu keşfet <span aria-hidden="true">↗</span></a><a class="bm-text-link" href="#bm-koleksiyonlar">Kategorileri gör ↓</a></div>
        <small>BAKIR MUTFAK ✦ ATÖLYEDEN SOFRAYA</small>
      </div>
      <div class="bm-hero-stage" aria-hidden="true"><div class="bm-platter"></div><div class="bm-pot"><div class="bm-pot-lid"></div><div class="bm-pot-knob"></div><div class="bm-pot-body"></div><div class="bm-pot-handle"></div></div><span class="bm-stage-sign">BAKIRIN ZAMANSIZ ESTETİĞİ</span></div>
    </section>
    <div class="bm-trust"><span>ÖZENLİ SEÇKİLER</span><span>ÜRÜN ÖZELLİKLERİ VE ÖLÇÜLER</span><span>GÜVENLİ ALIŞVERİŞ DENEYİMİ</span></div>
    <section class="bm-container bm-section" id="bm-koleksiyonlar">
      <div class="bm-section-head"><div><span class="bm-eyebrow">KOLEKSİYONLAR</span><h2>Bakırın her hâli.</h2></div><a class="bm-text-link" href="{{ route('shop.search.index') }}">Tüm ürünleri gör ↗</a></div>
      <div class="bm-grid">
        <a class="bm-tile bm-tile-coffee" href="{{ route('shop.search.index', ['query' => 'bakır cezve']) }}"><span>01 / KAHVE</span><i class="bm-tile-art bm-coffee" aria-hidden="true"></i><strong>Bakır Cezveler ↗</strong><small>Kahve ritüelleri için</small></a>
        <a class="bm-tile bm-tile-tea" href="{{ route('shop.search.index', ['query' => 'bakır çaydanlık']) }}"><span>02 / ÇAY</span><i class="bm-tile-art bm-tea" aria-hidden="true"></i><strong>Bakır Çaydanlıklar ↗</strong><small>Sofraların zamansız klasiği</small></a>
        <a class="bm-tile bm-tile-cook" href="{{ route('shop.search.index', ['query' => 'bakır tencere']) }}"><span>03 / MUTFAK</span><i class="bm-tile-art bm-cook" aria-hidden="true"></i><strong>Tencere & Sahan ↗</strong><small>Lezzetli sofralara ilham</small></a>
      </div>
    </section>
    <section class="bm-container bm-section bm-real-products">
      <div class="bm-section-head"><div><span class="bm-eyebrow">MAĞAZADAN</span><h2>Keşfetmeye değer.</h2></div><a class="bm-text-link" href="{{ route('shop.search.index') }}">Tüm ürünleri gör ↗</a></div>
      <x-shop::products.carousel title="Ürünler" :src="route('shop.api.products.index')" :navigation-link="route('shop.search.index')" aria-label="Bakır Mutfak ürün seçkisi"/>
    </section>
    <section class="bm-manifesto"><div class="bm-container"><span class="bm-eyebrow">BAKIR MUTFAK</span><h2>Her parçada bir hikâye.<br><em>Her sofrada bir bağ.</em></h2><p>Bakırın sıcaklığıyla çağdaş mutfağın sadeliğini buluşturan ürünler.</p><a href="{{ route('shop.search.index') }}">Ürünleri incele ↗</a></div></section>

    <!-- Storefront Sections -->
    @foreach ($sections as $section)
        @php
            $data = $section->options;

            $marks = ($preview ?? false)
                && ! $section->getTypeInstance()?->rendersInLayout();
        @endphp

        @if ($marks)
            <div
                data-section-id="{{ $section->id }}"
                data-section-name="{{ $section->name }}"
            >
        @endif

        <!-- Static Content -->
        @switch ($section->type)
            @case (\Webkul\Theme\Enums\SectionTypeEnum::IMAGE_CAROUSEL->value)
                <!-- Image Carousel -->
                <x-shop::carousel
                    :options="$section->getTypeInstance()?->sanitize((array) $data) ?? $data"
                    aria-label="{{ trans('shop::app.home.index.image-carousel') }}"
                />

                @break
            @case (\Webkul\Theme\Enums\SectionTypeEnum::STATIC_CONTENT->value)
                <!-- Push Style -->
                @if (! empty($data['css']))
                    @push ('styles')
                        <style>
                            {!! bagisto_theme_storage()->resolveMarkup($data['css']) !!}
                        </style>
                    @endpush
                @endif

                <!-- Render HTML -->
                @if (! empty($data['html']))
                    {!! bagisto_theme_storage()->resolveMarkup($data['html']) !!}
                @endif

                @break
            @case (\Webkul\Theme\Enums\SectionTypeEnum::CATEGORY_CAROUSEL->value)
                <!-- Categories Carousel -->
                <x-shop::categories.carousel
                    :title="$data['title'] ?? ''"
                    :src="route('shop.api.categories.index', array_merge((array) ($data['filters'] ?? []), $catalogQuery ?? []))"
                    :navigation-link="route('shop.home.index')"
                    aria-label="{{ trans('shop::app.home.index.categories-carousel') }}"
                />

                @break
            @case (\Webkul\Theme\Enums\SectionTypeEnum::PRODUCT_CAROUSEL->value)
                <!-- Product Carousel -->
                <x-shop::products.carousel
                    :title="$data['title'] ?? ''"
                    :src="route('shop.api.products.index', array_merge((array) ($data['filters'] ?? []), $catalogQuery ?? []))"
                    :navigation-link="route('shop.search.index', $data['filters'] ?? [])"
                    aria-label="{{ trans('shop::app.home.index.product-carousel') }}"
                />

                @break
        @endswitch

        @if ($marks)
            </div>
        @endif
    @endforeach

    @if ($preview ?? false)
        @include('shop::home.preview-bridge')
    @endif
</x-shop::layouts>
