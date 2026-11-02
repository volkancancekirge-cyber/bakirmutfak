#!/usr/bin/env python3
"""Read-only research of APPROVED product pages with JSON-LD Product metadata.

Public GitHub logs contain only counts and validation status; full product data is
not logged, downloaded into public artifacts or uploaded as store inventory.
"""
from __future__ import annotations
import argparse
from html.parser import HTMLParser
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import sys
from urllib.parse import urlparse
from urllib.request import build_opener, Request, HTTPRedirectHandler, ProxyHandler
from urllib.robotparser import RobotFileParser

USER_AGENT = "BakirMutfakApprovedCatalog/1.0"
MAX_BYTES = 1_500_000

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("Redirects disabled")

class JSONLD(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.active = False
        self.parts: list[str] = []
        self.documents: list[str] = []
    def handle_starttag(self, tag, attrs):
        if tag.lower() == "script" and dict(attrs).get("type", "").lower() == "application/ld+json":
            self.active = True
            self.parts = []
    def handle_data(self, data):
        if self.active:
            self.parts.append(data)
    def handle_endtag(self, tag):
        if tag.lower() == "script" and self.active:
            self.documents.append("".join(self.parts))
            self.active = False

def allow_public_host(url: str, approved_host: str) -> str:
    u = urlparse(url)
    h = (u.hostname or "").lower().rstrip(".")
    if (u.scheme != "https" or not approved_host or h != approved_host.lower().rstrip(".")
        or u.username or u.password or u.port not in (None, 443)
        or u.fragment or h in ("localhost", "localhost.localdomain")):
        raise ValueError("HTTPS approved hostname required")
    addresses = socket.getaddrinfo(h, u.port or 443, proto=socket.IPPROTO_TCP)
    if not addresses:
        raise ValueError("Host DNS resolution failed")
    if any(not ipaddress.ip_address(a[4][0]).is_global for a in addresses):
        raise ValueError("Private IP addresses are forbidden")
    return url

def get_product_page(url: str, host: str) -> bytes:
    safe = allow_public_host(url, host)
    opener = build_opener(NoRedirect(), ProxyHandler({}))
    robots_url = "https://" + host + "/robots.txt"
    robots = Request(robots_url, headers={"User-Agent": USER_AGENT})
    with opener.open(robots, timeout=12) as resp:
        txt = resp.read(200_001)
        if len(txt) > 200_000:
            raise ValueError("Robots file limit exceeded")
        rules = RobotFileParser()
        rules.parse(txt.decode("utf-8", "replace").splitlines())
    if not rules.can_fetch(USER_AGENT, safe):
        raise ValueError("Robots policy disallows access")
    req = Request(safe, headers={"User-Agent": USER_AGENT,"Accept":"text/html"})
    with opener.open(req, timeout=15) as response:
        if response.status != 200:
            raise ValueError("Product page unavailable")
        if "text/html" not in response.headers.get("Content-Type", "").lower():
            raise ValueError("Page does not contain HTML")
        data = response.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise ValueError("HTML page limit exceeded")
    return data

def parse_product_html(html: bytes) -> list[dict]:
    if len(html) > MAX_BYTES:
        raise ValueError("HTML page too large")
    parser=JSONLD()
    parser.feed(html.decode("utf-8", "replace"))
    found: list[dict]=[]
    def walk(x):
        if isinstance(x,list):
            for node in x: yield from walk(node)
        elif isinstance(x,dict):
            if "@graph" in x: yield from walk(x["@graph"])
            if "@type" in x:
                kinds=x["@type"]
                if isinstance(kinds,str): kinds=[kinds]
                if isinstance(kinds,list) and any(
                    isinstance(k,str) and k.rstrip("/").split("/")[-1].lower()=="product" for k in kinds
                ):
                    yield x
    for raw in parser.documents[:40]:
        try: d=json.loads(raw)
        except (json.JSONDecodeError,ValueError): continue
        for p in walk(d):
            name=p.get("name")
            if not isinstance(name,str) or len(name)>250 or not name.strip():continue
            offers=p.get("offers") or {}
            if isinstance(offers,list):offers=offers[0] if offers else {}
            if not isinstance(offers,dict):offers={}
            image=p.get("image",[])
            if isinstance(image,str):image=[image]
            image=[i for i in image[:8] if isinstance(i,str) and i.startswith("https://")] if isinstance(image,list) else []
            found.append({
                "source_title": name[:250],
                "source_sku": str(p.get("sku") or "")[:120],
                "has_offer": "price" in offers or "lowPrice" in offers,
                "image_url_count":len(image),
                "permission_verified":False,
                "ready_to_publish":False,
            })
    return found[:100]

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--fixture",type=Path)
    ap.add_argument("--url")
    args=ap.parse_args()
    try:
        if args.fixture:
            html=args.fixture.read_bytes()
        else:
            host=os.environ.get("APPROVED_PRODUCT_HOST","")
            if not args.url or not host:
                print(json.dumps({"status":"not_configured","ready_to_publish":False}))
                return 0
            html=get_product_page(args.url,host)
        results=parse_product_html(html)
        print(json.dumps({
            "status":"preview_only",
            "detected_products":len(results),
            "with_offers":sum(int(x["has_offer"]) for x in results),
            "with_image_urls":sum(int(x["image_url_count"]>0) for x in results),
            "rights_approved":False,
            "database_writes":0,
            "ready_to_publish":False,
        }))
        return 0
    except Exception as exc:
        print(json.dumps({"status":"failed","error_type":exc.__class__.__name__,"database_writes":0}))
        return 1

if __name__=="__main__":
    sys.exit(main())
