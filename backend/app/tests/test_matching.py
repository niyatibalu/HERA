import unittest

from app.adapters.mock_ehr_adapter import MockEHRAdapter
from app.data.providers import PROVIDERS
from app.engine.matching import MatchRequest, ProviderMatchingEngine


class TestProviderMatchingEngine(unittest.TestCase):
    def setUp(self):
        self.engine = ProviderMatchingEngine()
        self.maya = MockEHRAdapter().get_patient("maya-001")
        self.providers = list(PROVIDERS.values())
        self.request = MatchRequest(required_specialty="chronic_pelvic_pain", prefer_telehealth=True)

    def test_ranking_prefers_accessible_alternative_over_original_referral(self):
        results = self.engine.rank(self.maya, self.providers, self.request)
        ranked_ids = [r.provider.provider_id for r in results]
        best = ranked_ids[0]
        self.assertEqual(best, "prov-alt-best")
        # the originally referred specialist should rank near the bottom,
        # not the top, given its distance/wait/network problems
        original_rank = ranked_ids.index("prov-original-specialist")
        self.assertGreater(original_rank, ranked_ids.index("prov-alt-best"))
        self.assertGreater(original_rank, ranked_ids.index("prov-alt-ok"))

    def test_original_referral_carries_real_tradeoffs(self):
        results = self.engine.rank(self.maya, self.providers, self.request)
        original = next(r for r in results if r.provider.provider_id == "prov-original-specialist")
        tradeoff_text = " ".join(original.access_tradeoffs).lower()
        self.assertIn("out of network", tradeoff_text)
        self.assertIn("wait", tradeoff_text)
        self.assertIn("far", tradeoff_text)

    def test_best_match_carries_positive_reasons(self):
        results = self.engine.rank(self.maya, self.providers, self.request)
        best = results[0]
        self.assertTrue(best.match_reasons)
        reasons_text = " ".join(best.match_reasons).lower()
        self.assertIn("in-network", reasons_text)

    def test_language_preference_reflected(self):
        results = self.engine.rank(self.maya, self.providers, self.request)  # Maya prefers "es"
        best = next(r for r in results if r.provider.provider_id == "prov-alt-best")
        original = next(r for r in results if r.provider.provider_id == "prov-original-specialist")
        self.assertTrue(any("speaks es" in r.lower() for r in best.match_reasons))
        self.assertTrue(any("es" in t.lower() for t in original.access_tradeoffs))

    def test_scoring_is_deterministic(self):
        r1 = self.engine.rank(self.maya, self.providers, self.request)
        r2 = self.engine.rank(self.maya, self.providers, self.request)
        self.assertEqual([m.score for m in r1], [m.score for m in r2])

    def test_distance_is_computed_not_stubbed(self):
        results = self.engine.rank(self.maya, self.providers, self.request)
        chicago = next(r for r in results if r.provider.provider_id == "prov-original-specialist")
        madison = next(r for r in results if r.provider.provider_id == "prov-alt-best")
        self.assertGreater(chicago.distance_mi, madison.distance_mi)
        self.assertGreater(chicago.distance_mi, 100)  # Madison -> Chicago is ~120mi


if __name__ == "__main__":
    unittest.main()
