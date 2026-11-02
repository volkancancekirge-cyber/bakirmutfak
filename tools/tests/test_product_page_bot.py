import importlib.util
from pathlib import Path
import unittest
import unittest.mock
import sys

root=Path(__file__).resolve().parents[2]
s=importlib.util.spec_from_file_location("product_page_bot",root/"tools"/"product_page_bot.py")
m=importlib.util.module_from_spec(s)
sys.modules["product_page_bot"]=m
s.loader.exec_module(m)

HTML=b"""<!doctype html><html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Example Copper Cezve",
"sku":"EX-001","image":["https://example.org/image.jpg"],"offers":{"@type":"Offer","price":"150.00"}}
</script></head></html>"""
class ProductPageTest(unittest.TestCase):
    def test_jsonld_is_preview_only(self):
        result=m.parse_product_html(HTML)
        self.assertEqual(len(result),1)
        self.assertEqual(result[0]["source_sku"],"EX-001")
        self.assertFalse(result[0]["permission_verified"])
        self.assertFalse(result[0]["ready_to_publish"])
    def test_invalid_json_ignored(self):
        self.assertEqual(m.parse_product_html(b'<script type="application/ld+json">{bad</script>'),[])
    @unittest.mock.patch.object(m.socket,"getaddrinfo",return_value=[(0,0,0,"",("127.0.0.1",443))])
    def test_local_ip_block(self,_):
        with self.assertRaises(ValueError):
            m.allow_public_host("https://supplier.example/product/1","supplier.example")
    def test_different_host_block(self):
        with self.assertRaises(ValueError):
            m.allow_public_host("https://evil.example/product","supplier.example")
    def test_http_block(self):
        with self.assertRaises(ValueError):
            m.allow_public_host("http://supplier.example/product","supplier.example")
if __name__=="__main__":unittest.main()
