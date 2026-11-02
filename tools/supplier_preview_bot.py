#!/usr/bin/env python3
"""Bakır Mutfak: READ-ONLY supplier XML feed inspector.

- Only authorized supplier feed URLs, supplied via private environment secrets.
- Never fetches competitor pages, never copies photos, never writes to Supabase.
- Never outputs supplier product names, prices, credentials, or raw XML into public CI logs.
- No third-party dependencies.
"""
from __future__ import annotations
import argparse
import ipaddress
import json
import os
import re
import socket
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

MAX_BYTES = 5 * 1024 * 1024
MAX_ITEMS = 500
MAPPING = {
    "sku": ("StokKodu", "stok_kodu", "Sku", "SKU", "Kod", "sku"),
    "name": ("UrunAdi", "Urun_Adi", "Ad", "Name", "product_name"),
    "price": ("SatisFiyati", "Fiyat", "price", "Price"),
    "stock": ("StokAdedi", "Stok", "stock", "Adet"),
    "image": ("Gorsel", "Resim", "Resim1", "image", "ImageUrl", "Foto"),
}

def item_field(item: ET.Element, names: tuple[str, ...]) -> str:
    for name in names:
        if name in item.attrib and item.attrib[name].strip():
            return item.attrib[name].strip()
        element = item.find(name)
        if element is not None and element.text and element.text.strip():
            return element.text.strip()
    return ""

def verify_remote_url(url: str, approved_host: str) -> str:
    parsed = urllib.parse.urlparse(url)
    host = (parsed.hostname or "").lower().rstrip(".")
    approved = approved_host.lower().strip().rstrip(".")
    if (parsed.scheme != "https" or not approved
            or host != approved or parsed.username or parsed.password
            or parsed.port not in (None, 443) or parsed.fragment
            or not host or host == "localhost"):
        raise ValueError("Only a previously approved HTTPS supplier hostname is permitted")
    try:
        addresses = socket.getaddrinfo(host, parsed.port or 443, proto=socket.IPPROTO_TCP)
    except socket.gaierror as exc:
        raise ValueError("The supplier hostname did not resolve") from exc
    if not addresses:
        raise ValueError("No supplier IP address available")
    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])
        if not ip.is_global:
            raise ValueError("Private, loopback, or reserved supplier hosts are not allowed")
    return url

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ValueError("Supplier redirects are disabled to prevent unsafe targets")

def fetch_xml(url: str, host: str) -> bytes:
    safe_url = verify_remote_url(url, host)
    opener = urllib.request.build_opener(NoRedirect(), urllib.request.ProxyHandler({}))
    req = urllib.request.Request(safe_url, headers={
        "User-Agent": "BakirMutfakFeedPreview/1.0 (approved supplier data only)",
        "Accept": "application/xml,text/xml,*/*;q=0.5",
    })
    with opener.open(req, timeout=15) as response:
        if response.status != 200:
            raise ValueError("Supplier endpoint did not return HTTP 200")
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("The supplier feed exceeds the 5 MB inspection limit")
    return data

def preview(xml_data: bytes) -> dict:
    if len(xml_data) > MAX_BYTES:
        raise ValueError("Feed too large")
    if re.search(br"<!\s*(?:DOCTYPE|ENTITY)\b", xml_data, re.IGNORECASE):
        raise ValueError("DTD or XML entities are prohibited")
    try:
        root = ET.fromstring(xml_data)
    except ET.ParseError as exc:
        raise ValueError("XML parsing failed") from exc
    nodes = [x for x in root.iter() if x.tag.split("}")[-1] in
             ("Urun", "urun", "Product", "product", "Item", "item")]
    if not nodes:
        raise ValueError("No recognized product entries found")
    if len(nodes) > MAX_ITEMS:
        raise ValueError("Maximum 500 product entries per inspection")
    seen: set[str] = set()
    good = 0
    bad = 0
    has_image = 0
    for item in nodes:
        sku = item_field(item, MAPPING["sku"])
        name = item_field(item, MAPPING["name"])
        price = item_field(item, MAPPING["price"])
        stock = item_field(item, MAPPING["stock"])
        picture = item_field(item, MAPPING["image"])
        key = sku.casefold()
        valid = (re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{1,119}", sku) is not None
                 and 2 <= len(name) <= 250
                 and re.fullmatch(r"\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?", price) is not None
                 and re.fullmatch(r"\d{1,7}", stock) is not None
                 and int(stock) <= 1_000_000
                 and key not in seen)
        seen.add(key)
        if valid:
            good += 1
            if picture.startswith("https://"):
                has_image += 1
        else:
            bad += 1
    return {
        "mode": "read_only_preview",
        "total": len(nodes),
        "valid": good,
        "invalid": bad,
        "with_image_url": has_image,
        "writes_to_database": 0,
        "auto_publish": False,
        "ready_for_review": bad == 0 and good > 0,
    }

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fixture", type=Path, help="Offline test file, without network")
    args = parser.parse_args()
    try:
        if args.fixture:
            data = args.fixture.read_bytes()
            source = "offline_test"
        else:
            url = os.environ.get("APPROVED_SUPPLIER_FEED_URL", "")
            host = os.environ.get("APPROVED_SUPPLIER_HOST", "")
            if not url or not host:
                print(json.dumps({"status":"not_configured","message":"Approved supplier feed has not been provided.","writes_to_database":0}))
                return 0
            data = fetch_xml(url, host)
            source = "approved_supplier"
        report = preview(data)
        report["source"] = source
        print(json.dumps(report, ensure_ascii=False))
        return 0 if report["ready_for_review"] else 2
    except (ValueError, OSError, urllib.error.URLError) as err:
        # Avoid printing raw URLs or credential-bearing messages from external libraries.
        print(json.dumps({"status":"inspection_failed","detail":err.__class__.__name__,"writes_to_database":0}))
        return 1

if __name__ == "__main__":
    sys.exit(main())
