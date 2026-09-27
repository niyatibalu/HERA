import os
import unittest

from hera_map.conditions import clear_conditions, scenario_conditions
from hera_map.routing import route_candidates
from hera_map.scoring import default_weights, rank
from hera_map.sources import WORLD

from .test_world import ServerCase

os.environ.setdefault("HERA_DEMO_MODE", "1")
MAYA = WORLD.patients["maya-001"]
ORIGIN = (MAYA["home_location"]["lat"], MAYA["home_location"]["lon"])
PROV = {p["provider_id"]: p for p in WORLD.providers}


def ranked(pid, pregnant, cond=None):
    p = PROV[pid]
    return rank(route_candidates("maya-001", ORIGIN, p), MAYA, p, cond or clear_conditions(), default_weights(), None, pregnant)


def check(option, word):
    return next(c for c in option["pregnancy_check"] if word in c["label"].lower())


class PregnancyRoutingTest(unittest.TestCase):
    def test_pregnancy_factors_only_when_pregnant(self):
        off = ranked("prov-alt-best", False)["options"][0]
        on = ranked("prov-alt-best", True)["options"][0]
        self.assertNotIn("obstetric_access_score", off["factor_scores"])
        self.assertIn("obstetric_access_score", on["factor_scores"])
        for f in ("ride_smoothness_score", "restrooms_score", "food_water_score", "air_quality_score"):
            self.assertIn(f, on["factor_scores"])
        self.assertNotIn("obstetric_access", ranked("prov-alt-best", False)["weights"])

    def test_long_trip_gets_stop_reminder_and_labor_delivery_hospitals(self):
        opt = next(o for o in ranked("prov-original-specialist", True)["options"] if o["mode"] != "transit")
        self.assertIn("Plan a stop to walk, stretch, drink water and eat at least every 1–2 hours.", opt["cautions"])
        self.assertTrue(any("labor & delivery" in c["label"] for c in opt["pregnancy_check"]))

    def test_never_claims_safe_in_pregnancy_mode(self):
        for pid in PROV:
            for o in ranked(pid, True)["options"]:
                text = " ".join([o["label"], *o["reasons"], *o["conditions"], *o["cautions"]]).lower()
                self.assertNotRegex(text, r"\bsafe\b|\bsafest\b")


class PregnancyChecksTest(unittest.TestCase):
    def setUp(self):
        self.opts = {o["route_id"]: o for o in ranked("prov-alt-best", True, scenario_conditions("winter_storm", "2025-12-29"))["options"]}

    def test_potholes_make_the_fast_route_bumpy(self):
        self.assertFalse(check(self.opts["alt-best-regent"], "bumpy")["ok"])
        self.assertTrue(check(self.opts["alt-best-beltline"], "smooth ride")["ok"])

    def test_construction_dust_is_flagged_as_air_quality(self):
        dust = check(self.opts["alt-best-regent"], "construction dust")
        self.assertFalse(dust["ok"])
        self.assertIn("unhealthy for sensitive groups, including pregnancy", dust["label"])
        self.assertTrue(check(self.opts["alt-best-beltline"], "no construction zones")["ok"])

    def test_restrooms_food_and_benches(self):
        self.assertTrue(check(self.opts["alt-best-beltline"], "restroom")["ok"])
        self.assertTrue(check(self.opts["alt-best-beltline"], "eat or get water")["ok"])
        self.assertIn("3 benches", check(self.opts["alt-best-transit"], "bench")["label"])

    def test_recommended_for_pregnancy_explains_why(self):
        rec = next(o for o in self.opts.values() if o["recommended"])
        self.assertEqual(rec["label"], "Recommended for pregnancy")
        self.assertIn("smoother ride", rec["reasons"][0])
        self.assertIn("construction dust", rec["reasons"][0])


class PregnancyEndpointTest(ServerCase):
    def test_routes_pregnancy_block(self):
        status, r = self.get("/routes?provider_id=prov-alt-best&pregnant=1")
        self.assertEqual(status, 200)
        self.assertTrue(r["pregnancy"]["tips"])
        self.assertEqual(r["pregnancy"]["labor_delivery_near_destination"][0]["name"], "Capitol Area Hospital")
        self.assertIsNone(self.get("/routes?provider_id=prov-alt-best")[1]["pregnancy"])
