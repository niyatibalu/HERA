import json
import subprocess
import sys
import unittest
from pathlib import Path

from hera_map.analytics import MIN_CELL, access_analytics, referrals

from .test_world import ServerCase

MAP_DIR = Path(__file__).resolve().parent.parent


class AnalyticsTest(unittest.TestCase):
    def test_summary_metrics_present_and_consistent(self):
        a = access_analytics()
        s = a["summary"]
        self.assertEqual(a["cohort"]["referrals"], len(referrals()))
        self.assertLessEqual(s["patients_over_30_mi"]["after_hera"], s["patients_over_30_mi"]["original_referral"])
        self.assertLess(s["avg_travel_distance_mi"]["after_hera"], s["avg_travel_distance_mi"]["original_referral"])
        self.assertLess(s["wait_time_barriers"]["avg_wait_days_after_hera"], s["wait_time_barriers"]["avg_wait_days_original"])
        self.assertGreater(s["rerouting_improvement"]["distance_mi"]["avg_reduction"], 0)
        self.assertIn("rural", s["telehealth_utilization"]["by_region_type"])
        self.assertTrue(a["route_access_barriers"])
        for key in ("insurance_barriers", "stalled_care_pathways", "completion_rate_pct"):
            self.assertIn(key, s)

    def test_care_gaps_are_rural_and_small_cells_suppressed(self):
        a = access_analytics()
        self.assertTrue(a["geographic_care_gaps"])
        self.assertTrue(all(g["region_type"] == "rural" for g in a["geographic_care_gaps"]))
        self.assertTrue(all(r["referrals"] >= MIN_CELL for r in a["by_region"]))

    def test_no_record_level_data_exposed(self):
        blob = json.dumps(access_analytics())
        self.assertNotIn("ref-0", blob)
        self.assertNotIn('"home"', blob)

    def test_filters(self):
        rural = access_analytics(region_type="rural")
        self.assertTrue(all(r["region_type"] == "rural" for r in rural["by_region"]))
        self.assertEqual(access_analytics(region="Nowhere")["cohort"]["referrals"], 0)

    def test_generator_is_deterministic(self):
        path = MAP_DIR / "hera_map" / "data" / "synthetic_referrals.json"
        before = path.read_bytes()
        subprocess.run([sys.executable, str(MAP_DIR / "tools" / "generate_referrals.py")], check=True, capture_output=True)
        self.assertEqual(before, path.read_bytes())


class AnalyticsEndpointTest(ServerCase):
    def test_endpoint(self):
        status, a = self.get("/analytics/access?region_type=urban")
        self.assertEqual(status, 200)
        self.assertEqual(a["filters"]["region_type"], "urban")


if __name__ == "__main__":
    unittest.main()
