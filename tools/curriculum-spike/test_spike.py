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


def work(id: str, *facets: str) -> spike.Work:
    return spike.Work(id, id, "met", "v", None, {f: f for f in facets})


class Rank(unittest.TestCase):
    # Counts across the collection: n=2 gives specificity 1/log2(4) = 0.5,
    # n=14 gives 1/log2(16) = 0.25, n=254 gives 1/log2(256) = 0.125.
    TOTALS = {"rare": 2, "common": 14, "generic": 254, "other": 2, "third": 2}

    def test_the_rarer_shared_facet_wins(self):
        learner = [work("e1", "rare", "common")]
        ranked = spike.rank([work("c1", "rare", "common")], learner, self.TOTALS)
        self.assertEqual(ranked[0].anchors["e1"], ("rare", 0.5))

    def test_only_the_two_strongest_anchors_count(self):
        # Three encounters that share nothing with each other except "generic": no
        # bridge, and the third anchor adds nothing.
        learner = [work(f"e{i}", "generic") for i in range(3)]
        (r,) = spike.rank([work("c", "generic")], learner, self.TOTALS)
        self.assertEqual(len(r.anchors), 3)
        self.assertEqual(r.bridges, [])
        self.assertAlmostEqual(r.score, 0.25)

    def test_a_bridge_needs_unconnected_encounters_and_different_facets(self):
        learner = [work("e1", "rare"), work("e2", "other")]
        (r,) = spike.rank([work("c", "rare", "other")], learner, self.TOTALS)
        self.assertEqual(r.bridges, [("e1", "e2")])
        self.assertAlmostEqual(r.score, 0.5 + 0.5 + spike.BRIDGE_BONUS * 0.5)

        # The same two encounters already share a facet: nothing new is joined.
        learner = [work("e1", "rare", "common"), work("e2", "other", "common")]
        (r,) = spike.rank([work("c", "rare", "other")], learner, self.TOTALS)
        self.assertEqual(r.bridges, [])
        self.assertAlmostEqual(r.score, 1.0)

    def test_the_bridge_bonus_is_paid_once(self):
        # Three unconnected encounters reached three ways make three bridges, but
        # only the best one pays.
        learner = [work("e1", "rare"), work("e2", "other"), work("e3", "third")]
        (r,) = spike.rank([work("c", "rare", "other", "third")], learner, self.TOTALS)
        self.assertEqual(len(r.bridges), 3)
        self.assertAlmostEqual(r.score, 0.5 + 0.5 + spike.BRIDGE_BONUS * 0.5)

    def test_unconnected_candidates_are_dropped_and_the_rest_sorted(self):
        learner = [work("e1", "rare"), work("e2", "common")]
        candidates = [work("weak", "common"), work("none", "x"), work("strong", "rare")]
        ranked = spike.rank(candidates, learner, self.TOTALS)
        self.assertEqual([r.work.id for r in ranked], ["strong", "weak"])

    def test_an_uncounted_facet_gets_the_default(self):
        (r,) = spike.rank([work("c", "unseen")], [work("e1", "unseen")], self.TOTALS)
        self.assertAlmostEqual(r.score, 0.5)


if __name__ == "__main__":
    unittest.main()
