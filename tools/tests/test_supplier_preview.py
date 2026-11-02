"""Offline checks for the approved-source preview bot."""
import importlib.util
from pathlib import Path
import unittest
import unittest.mock
import sys

BASE = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("supplier_bot", BASE / "tools" / "supplier_preview_bot.py")
bot = importlib.util.module_from_spec(spec)
sys.modules["supplier_bot"] = bot
spec.loader.exec_module(bot)

class SupplierFeedTests(unittest.TestCase):
    def test_example_is_read_only(self):
        sample = (BASE / "apps/storefront/public/samples/ornek-urunler.xml").read_bytes()
        report = bot.preview(sample)
        self.assertEqual(report["valid"], 2)
        self.assertEqual(report["invalid"], 0)
        self.assertEqual(report["writes_to_database"], 0)
        self.assertFalse(report["auto_publish"])
    def test_doctype_blocked(self):
        with self.assertRaises(ValueError):
            bot.preview(b'<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><Urunler/>')
    def test_duplicate_sku_detected(self):
        data = b'<Urunler><Urun><StokKodu>AA-1</StokKodu><UrunAdi>Bakir Cezve</UrunAdi><SatisFiyati>100</SatisFiyati><StokAdedi>1</StokAdedi></Urun><Urun><StokKodu>AA-1</StokKodu><UrunAdi>Bakir Sahan</UrunAdi><SatisFiyati>100</SatisFiyati><StokAdedi>1</StokAdedi></Urun></Urunler>'
        report = bot.preview(data)
        self.assertEqual(report["invalid"], 1)
    @unittest.mock.patch.object(bot.socket, "getaddrinfo", return_value=[(0,0,0,"",("127.0.0.1",443))])
    def test_private_ip_rejected(self, _):
        with self.assertRaises(ValueError):
            bot.verify_remote_url("https://supplier.example/catalog.xml", "supplier.example")
    def test_disallowed_host_rejected(self):
        with self.assertRaises(ValueError):
            bot.verify_remote_url("https://attacker.example/catalog.xml", "supplier.example")
    def test_http_rejected(self):
        with self.assertRaises(ValueError):
            bot.verify_remote_url("http://supplier.example/catalog.xml", "supplier.example")

if __name__ == "__main__":
    unittest.main()
