<?php
declare(strict_types=1);
// Usage: php tools/install-theme.php /path/to/bagisto-2.5
$target = rtrim($argv[1] ?? '', '/\\');
$cfg = $target . '/config/themes.php';
if ($target === '' || !is_file($cfg) || !is_file($target . '/packages/Webkul/Shop/src/Resources/views/home/index.blade.php')) {
    fwrite(STDERR, "Provide a valid Bagisto 2.5 project directory.\n");
    exit(1);
}
$contents = file_get_contents($cfg);
if ($contents === false) { throw new RuntimeException('Could not read theme config'); }
if (!str_contains($contents, "'bakirmutfak' => [")) {
    $needle = "    'shop' => [";
    if (substr_count($contents, $needle) !== 1) { throw new RuntimeException('Unexpected Bagisto config format. Refusing to patch'); }
    $entry = <<<'PHP'
        'bakirmutfak' => [
            'name' => 'Bakır Mutfak Signature',
            'parent' => 'default',
            'assets_path' => 'public/themes/shop/default',
            'views_path' => 'resources/themes/bakirmutfak/views',
            'vite' => [
                'hot_file' => 'shop-default-vite.hot',
                'build_directory' => 'themes/shop/default/build',
                'package_assets_directory' => 'src/Resources/assets',
            ],
        ],
PHP;
    file_put_contents($cfg, str_replace($needle, $needle . "\n" . $entry . "\n", $contents));
}
$src = dirname(__DIR__) . '/theme';
$count = 0;
foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($src, FilesystemIterator::SKIP_DOTS)) as $file) {
    if (!$file->isFile()) { continue; }
    $relative = substr($file->getPathname(), strlen($src) + 1);
    $dest = $target . '/' . $relative;
    if (!is_dir(dirname($dest)) && !mkdir(dirname($dest), 0755, true) && !is_dir(dirname($dest))) {
        throw new RuntimeException('Could not create destination');
    }
    if (!copy($file->getPathname(), $dest)) { throw new RuntimeException('Could not copy ' . $relative); }
    $count++;
}
echo "Bakır Mutfak theme: {$count} files copied. Activate bakirmutfak in channel theme settings. Clear config cache.\n";

// Register the XML admin extension after Bagisto AdminServiceProvider.
$providersPath = $target . '/bootstrap/providers.php';
$providers = file_get_contents($providersPath);
$needle = "    AdminServiceProvider::class,";
$registration = "    \\App\\Providers\\BakirMutfakXmlServiceProvider::class,";
if (!str_contains($providers, 'BakirMutfakXmlServiceProvider::class')) {
    if (substr_count($providers, $needle) !== 1) {
        throw new RuntimeException('Unexpected provider list: refusing to alter auth configuration');
    }
    $providers = str_replace($needle, $needle . "\n" . $registration, $providers);
    if (file_put_contents($providersPath, $providers) === false) {
        throw new RuntimeException('Unable to register BakirMutfakXmlServiceProvider');
    }
}
