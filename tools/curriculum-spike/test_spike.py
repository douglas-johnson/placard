"""python3 -m unittest tools/curriculum-spike/test_spike.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import spike  # noqa: E402


class MetEdtf(unittest.TestCase):
    def test_bce_is_astronomical(self):
        # The Aristomache lekythos: the Met says -375/-350 and "ca. 375–350 BCE"; the
        # fixture says -0374~/-0349~ (D5). Off by one is the whole point.
        self.assertEqual(spike.met_edtf(-375, -350, "ca. 375–350 BCE"), "-0374~/-0349~")

    def test_ce_and_single_year(self):
        self.assertEqual(spike.met_edtf(1910, 1911, "1910–11"), "1910/1911")
        self.assertEqual(spike.met_edtf(1774, 1774, "ca. 1774"), "1774~")

    def test_one_bce_is_year_zero(self):
        self.assertEqual(spike.met_edtf(-1, 1, "1 BCE–1 CE"), "0000/0001")

    def test_no_date(self):
        self.assertIsNone(spike.met_edtf(0, 0, ""))


class Terms(unittest.TestCase):
    def test_first_term(self):
        self.assertEqual(spike.first_term("Marble, Pentelic"), "marble")
        self.assertEqual(spike.first_term("Offset lithograph on paper"), "offset lithograph")


if __name__ == "__main__":
    unittest.main()
