<?php
/**
 * Bakır Mutfak supplier XML -> Bagisto 2.5 Data Transfer CSV.
 * Run on the server/CI, not the user's computer.
 * Does not update/delete products or fetch remote URLs.
 *
 * php tools/xml-to-bagisto.php input.xml output.csv config/tedarikci-ornek.json [--dry-run]
 */
declare(strict_types=1);

function stopImport(string $why): never
{
    fwrite(STDERR, "XML import rejected: ".$why."\n");
    exit(1);
}

/** @return list<string> */
function xmlValues(SimpleXMLElement $node, array|string $paths): array
{
    $all = [];

    foreach ((array) $paths as $path) {
        if (! is_string($path) || ! preg_match('/^@?[\pL\pN_:-]+(?:\.@?[\pL\pN_:-]+)*$/u', $path)) {
            throw new RuntimeException('Unsupported XML field mapping');
        }

        $nodes = [$node];

        foreach (explode('.', $path) as $part) {
            $new = [];

            foreach ($nodes as $current) {
                if (str_starts_with($part, '@')) {
                    $key = substr($part, 1);

                    if (isset($current[$key])) {
                        $new[] = trim((string) $current[$key]);
                    }

                    continue;
                }

                foreach ($current->children() as $child) {
                    if ($child->getName() === $part) {
                        $new[] = $child;
                    }
                }
            }

            $nodes = $new;
        }

        foreach ($nodes as $current) {
            $text = trim((string) $current);

            if ($text !== '') {
                $all[] = $text;
            }
        }
    }

    return array_values(array_unique($all));
}

function xmlField(SimpleXMLElement $node, array $mapping, string $field): string
{
    return xmlValues($node, $mapping['fields'][$field] ?? [])[0] ?? '';
}

function priceValue(string $price): string
{
    $price = str_replace(["\xc2\xa0", '₺', 'TRY', 'TL', ' '], '', trim($price));

    if (! preg_match('/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$|^\d+(?:[,.]\d{1,2})?$/D', $price)) {
        throw new DomainException('Invalid or ambiguous Turkish price');
    }

    if (preg_match('/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/D', $price)) {
        $price = str_replace('.', '', $price);
    }

    $price = str_replace(',', '.', $price);

    if ((float) $price <= 0 || (float) $price > 10000000) {
        throw new DomainException('Price must be positive and within permitted range');
    }

    return number_format((float) $price, 2, '.', '');
}

function urlSlug(string $value): string
{
    $value = mb_strtolower($value, 'UTF-8');
    $value = strtr($value, ['ı'=>'i','ğ'=>'g','ü'=>'u','ş'=>'s','ö'=>'o','ç'=>'c']);
    $value = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $value) ?: $value;
    return trim(substr((string) preg_replace('/[^a-z0-9]+/', '-', $value), 0, 100), '-');
}

function safeImages(array $urls): string
{
    $out = [];

    foreach ($urls as $url) {
        $p = parse_url($url);

        if (! is_array($p)
            || strtolower((string) ($p['scheme'] ?? '')) !== 'https'
            || empty($p['host'])
            || isset($p['user'])
            || isset($p['pass'])
            || filter_var($p['host'], FILTER_VALIDATE_IP)
            || in_array(strtolower($p['host']), ['localhost', 'localhost.localdomain'], true)
            || strlen($url) > 2000
            || str_contains($url, ',')
        ) {
            throw new DomainException('Image URL must use a valid HTTPS hostname');
        }

        $out[$url] = true;

        if (count($out) > 8) {
            throw new DomainException('Maximum eight images per product');
        }
    }

    return implode(',', array_keys($out));
}

/** @return array{0:array<string,string>,1:bool} */
function normalizedProduct(SimpleXMLElement $node, array $mapping): array
{
    $sku = xmlField($node, $mapping, 'sku');
    $name = xmlField($node, $mapping, 'name');

    if (! preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{1,119}$/D', $sku)) {
        throw new DomainException('Missing or invalid SKU');
    }

    if ($name === '' || mb_strlen($name) > 250 || preg_match('/^[=+@-]/', $name)) {
        throw new DomainException('Missing or invalid name');
    }

    $price = priceValue(xmlField($node, $mapping, 'price'));
    $stockRaw = xmlField($node, $mapping, 'stock');

    if (! preg_match('/^\d{1,7}$/D', $stockRaw) || (int) $stockRaw > 1000000) {
        throw new DomainException('Stock is required and must be 0..1000000');
    }

    $stock = (int) $stockRaw;
    $images = safeImages(xmlValues($node, $mapping['fields']['images'] ?? []));
    $description = htmlspecialchars(strip_tags(xmlField($node, $mapping, 'description')), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $defaults = $mapping['defaults'] ?? [];
    $weight = (string) ($defaults['weight'] ?? '0.5');

    if (! preg_match('/^\d+(?:\.\d{1,3})?$/D', $weight) || (float) $weight <= 0) {
        throw new DomainException('Invalid weight default');
    }

    $slug = urlSlug($name).'-'.urlSlug($sku);

    if ($slug === '-') {
        throw new DomainException('Invalid product slug');
    }

    $row = [
        'sku' => $sku,
        'type' => 'simple',
        'attribute_family_code' => (string) ($defaults['attribute_family_code'] ?? 'default'),
        'locale' => (string) ($defaults['locale'] ?? 'tr'),
        'channel' => (string) ($defaults['channel'] ?? 'default'),
        'name' => $name,
        'url_key' => $slug,
        'description' => $description,
        'short_description' => mb_substr($description, 0, 250),
        'price' => $price,
        'weight' => $weight,
        'status' => (($defaults['publish'] ?? false) === true && $stock > 0 && $images !== '') ? '1' : '0',
        'visible_individually' => '1',
        'manage_stock' => '1',
        'inventories' => (string) ($defaults['inventory_source'] ?? 'default').'='.$stock,
        'images' => $images,
        'meta_title' => $name.' | Bakır Mutfak',
        'meta_description' => mb_substr($name.' modellerini ve özelliklerini Bakır Mutfak’ta keşfedin.', 0, 155),
    ];

    return [$row, $images === ''];
}

$input = $argv[1] ?? '';
$output = $argv[2] ?? '';
$mappingFile = $argv[3] ?? '';
$dryRun = in_array('--dry-run', $argv, true);

if (! is_file($input) || ! is_file($mappingFile) || $output === '' || realpath($input) === realpath($output)) {
    stopImport('Usage: php tools/xml-to-bagisto.php input.xml output.csv config/mapping.json [--dry-run]');
}

if (! extension_loaded('xmlreader') || ! extension_loaded('simplexml') || ! extension_loaded('mbstring')) {
    stopImport('PHP extensions XMLReader, SimpleXML and mbstring required');
}

if (filesize($input) > 25 * 1024 * 1024) {
    stopImport('XML file exceeds 25 MB');
}

try {
    $mapping = json_decode((string) file_get_contents($mappingFile), true, 512, JSON_THROW_ON_ERROR);
} catch (Throwable $e) {
    stopImport('Bad mapping JSON: '.$e->getMessage());
}

if (! is_array($mapping) || ! isset($mapping['item_tag']) || ! preg_match('/^[\pL\pN_:-]+$/u', (string) $mapping['item_tag'])) {
    stopImport('Missing/invalid item_tag');
}

foreach (['sku', 'name', 'price', 'stock'] as $required) {
    if (empty($mapping['fields'][$required])) {
        stopImport('Mapping field missing: '.$required);
    }
}

$reader = new XMLReader;

if (! $reader->open($input, null, LIBXML_NONET | LIBXML_COMPACT)) {
    stopImport('XML input unreadable');
}

$reader->setParserProperty(XMLReader::LOADDTD, false);
$reader->setParserProperty(XMLReader::SUBST_ENTITIES, false);

$count = 0;
$rows = [];
$seen = [];
$errors = [];
$missingImages = 0;

try {
    while ($reader->read()) {
        if ($reader->nodeType === XMLReader::DOC_TYPE) {
            throw new RuntimeException('DOCTYPE/external entities not allowed');
        }

        if ($reader->nodeType !== XMLReader::ELEMENT || $reader->localName !== $mapping['item_tag']) {
            continue;
        }

        if (++$count > 5000) {
            throw new RuntimeException('Maximum 5000 products per file');
        }

        $fragment = $reader->readOuterXML();

        if (strlen($fragment) > 1024 * 1024) {
            throw new RuntimeException('One product is over 1 MB');
        }

        $element = simplexml_load_string($fragment, SimpleXMLElement::class, LIBXML_NONET);

        if ($element === false) {
            throw new RuntimeException('Invalid product XML on item '.$count);
        }

        try {
            [$row, $missing] = normalizedProduct($element, $mapping);

            if (isset($seen[strtolower($row['sku'])])) {
                throw new DomainException('Duplicate SKU in feed');
            }

            $seen[strtolower($row['sku'])] = true;
            $missingImages += (int) $missing;
            $rows[] = $row;
        } catch (DomainException $e) {
            $errors[] = ['item' => $count, 'error' => $e->getMessage()];
        }
    }
} catch (Throwable $e) {
    $reader->close();
    stopImport($e->getMessage());
}

$reader->close();

$report = [
    'total' => $count,
    'valid' => count($rows),
    'invalid' => count($errors),
    'missing_images' => $missingImages,
    'preview' => array_slice(array_map(static fn ($r) => [
        'sku' => $r['sku'],
        'name' => $r['name'],
        'price' => $r['price'],
        'stock' => $r['inventories'],
        'status' => $r['status'],
    ], $rows), 0, 5),
    'errors' => array_slice($errors, 0, 15),
    'mode' => $dryRun ? 'review_only' : 'export',
];

echo json_encode($report, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n";

if ($count === 0 || $errors !== []) {
    stopImport('Unsafe/invalid data: no output written');
}

if ($dryRun) {
    exit(0);
}

if (! is_dir(dirname($output))) {
    stopImport('Output directory does not exist');
}

$tmp = tempnam(dirname($output), '.bm-xml-');

if ($tmp === false || ($file = fopen($tmp, 'wb')) === false) {
    stopImport('Could not create temp output');
}

try {
    fputcsv($file, array_keys($rows[0]), ',', '"', '');

    foreach ($rows as $row) {
        fputcsv($file, array_values($row), ',', '"', '');
    }

    fclose($file);

    if (! rename($tmp, $output)) {
        throw new RuntimeException('Could not publish validated CSV');
    }
} catch (Throwable $e) {
    if (is_resource($file)) {
        fclose($file);
    }

    @unlink($tmp);
    stopImport($e->getMessage());
}

fwrite(STDERR, "Valid CSV created: ".$output."\n");
