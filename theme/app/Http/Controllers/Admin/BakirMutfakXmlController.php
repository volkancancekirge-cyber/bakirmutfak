<?php

namespace App\Http\Controllers\Admin;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Str;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\Process\Process;

class BakirMutfakXmlController extends Controller
{
    private const MAX_AGE_SECONDS = 1800;

    public function index(): View
    {
        return view('bakirmutfak.xml-import', [
            'report' => null,
            'token' => null,
        ]);
    }

    public function preview(Request $request): View
    {
        $request->validate([
            'feed' => ['required', 'file', 'extensions:xml', 'max:25600'],
        ]);

        // Private server-side directory; no uploads or previews enter the public disk.
        $dir = storage_path('app/private/bakirmutfak/xml-previews');

        if (! is_dir($dir) && ! mkdir($dir, 0700, true) && ! is_dir($dir)) {
            abort(500, 'Ön izleme klasörü hazırlanamadı.');
        }

        $token = Str::random(40);
        $source = $dir.'/'.$token.'.xml';
        $output = $dir.'/'.$token.'.csv';
        $request->file('feed')->move($dir, basename($source));

        try {
            $process = new Process([
                PHP_BINARY,
                base_path('tools/bm-xml-to-bagisto.php'),
                $source,
                $output,
                base_path('config/bm-xml-mapping.json'),
            ]);

            $process->setTimeout(120);
            $process->run();

            $report = json_decode($process->getOutput(), true);

            if (! $process->isSuccessful() || ! is_array($report) || ! is_file($output)) {
                if (is_file($output)) {
                    @unlink($output);
                }

                return view('bakirmutfak.xml-import', [
                    'report' => is_array($report) ? $report : null,
                    'token' => null,
                    'error' => 'Dosya doğrulanamadı. Hataları düzeltip yeniden yükleyin; hiçbir ürün değiştirilmedi.',
                ]);
            }

            $request->session()->put('bakirmutfak.xml.'.$token, [
                'path' => $output,
                'admin_id' => (int) auth()->guard('admin')->id(),
                'created_at' => time(),
            ]);

            return view('bakirmutfak.xml-import', compact('report', 'token'));
        } finally {
            if (is_file($source)) {
                @unlink($source);
            }
        }
    }

    public function download(Request $request, string $token): BinaryFileResponse
    {
        $key = 'bakirmutfak.xml.'.$token;
        $entry = $request->session()->get($key);

        if (! is_array($entry)
            || (int) ($entry['admin_id'] ?? 0) !== (int) auth()->guard('admin')->id()
            || time() - (int) ($entry['created_at'] ?? 0) > self::MAX_AGE_SECONDS
        ) {
            abort(404);
        }

        $path = $entry['path'] ?? '';
        $dir = realpath(storage_path('app/private/bakirmutfak/xml-previews'));
        $file = is_string($path) ? realpath($path) : false;

        if (! $dir || ! $file || dirname($file) !== $dir || ! is_file($file)) {
            abort(404);
        }

        $request->session()->forget($key);

        return response()->download($file, 'bakirmutfak-urunler.csv', [
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ])->deleteFileAfterSend(true);
    }
}
