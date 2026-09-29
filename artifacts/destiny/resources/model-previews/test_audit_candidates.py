import unittest
from audit_candidates import compare


class GrindComparisonTest(unittest.TestCase):
    def test_explicit_plus_and_invalid_values(self):
        row = {"fields": {"ATP": "100-200", "Required": "ATP 300", "ATA": "40", "MST": "0"}}
        pmt = {"parameters": {"atpmin": 100, "atpmax": 200, "atpreq": 300, "ata": 40, "mst": 0, "maxgrind": 50}}
        for value in ("50", "+50", "  +50  "):
            with self.subTest(value=value):
                row["fields"]["Grind"] = value
                self.assertEqual(len(compare(row, pmt)), 6)
        for value in ("", "+51", "-50", "+50foo"):
            with self.subTest(value=value):
                row["fields"]["Grind"] = value
                self.assertIsNone(compare(row, pmt))


if __name__ == "__main__":
    unittest.main()
