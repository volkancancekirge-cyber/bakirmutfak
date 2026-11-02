<?php

namespace App\Providers;

use App\Http\Controllers\Admin\BakirMutfakXmlController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;
use Webkul\Core\Http\Middleware\NoCacheMiddleware;

class BakirMutfakXmlServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Reuse Bagisto ACL hierarchy so unauthorized staff cannot access preview/download.
        $acl = config('acl', []);

        $acl[] = [
            'key' => 'settings.data_transfer.imports.bakirmutfak',
            'name' => 'Bakır Mutfak XML Kontrolü',
            'route' => [
                'admin.bakirmutfak.xml.index',
                'admin.bakirmutfak.xml.preview',
                'admin.bakirmutfak.xml.download',
            ],
            'sort' => 5,
        ];

        config()->set('acl', $acl);

        $menu = config('menu.admin', []);

        $menu[] = [
            'key' => 'settings.data_transfer.imports.bakirmutfak',
            'name' => 'Bakır Mutfak XML',
            'route' => 'admin.bakirmutfak.xml.index',
            'sort' => 5,
            'icon' => '',
        ];

        config()->set('menu.admin', $menu);
    }

    public function boot(): void
    {
        Route::middleware(['web', 'admin', NoCacheMiddleware::class])
            ->prefix(config('app.admin_url'))
            ->group(function (): void {
                Route::get('bakirmutfak/xml', [BakirMutfakXmlController::class, 'index'])
                    ->name('admin.bakirmutfak.xml.index');

                Route::post('bakirmutfak/xml/preview', [BakirMutfakXmlController::class, 'preview'])
                    ->middleware('throttle:6,1')
                    ->name('admin.bakirmutfak.xml.preview');

                Route::get('bakirmutfak/xml/download/{token}', [BakirMutfakXmlController::class, 'download'])
                    ->where('token', '[A-Za-z0-9]{40}')
                    ->middleware('throttle:12,1')
                    ->name('admin.bakirmutfak.xml.download');
            });
    }
}
