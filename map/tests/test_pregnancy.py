import os
import unittest

from hera_map.conditions import clear_conditions
from hera_map.routing import route_candidates
from hera_map.scoring import default_weights, rank
from hera_map.sources import WORLD

from .test_world import ServerCase

os.environ.setdefault("HERA_DEMO_MODE", "1")
MAYA = WORLD.patients["maya-001"]
ORIGIN = (MAYA["home_location"]["lat"], MAYA["home_location"]["lon"])
PROV = {p["provider_id"]: p for p in WORLD.providers}


def ranked(pid, pregnant):
    p = PROV[pid]
    return rank(route_candidates("maya-001", ORIGIN, p), MAYA, p, clear_conditions(), default_weights(), None, pregnant)


class PregnancyRoutingTest(unittest.TestCase):
    def test_pregnancy_factors_only_when_pregnant(self):
        off = ranked("prov-alt-best", False)["options"][0]
        on = ranked("prov-alt-best", True)["options"][0]
        self.assertNotIn("obstetric_access_score", off["factor_scores"])
        self.assertIn("obstetric_access_score", on["factor_scores"])
        self.assertIn("rest_stops_score", on["factor_scores"])
        self.assertNotIn("obstetric_access", ranked("prov-alt-best", False)["weights"])

    def test_long_trip_gets_stop_reminder_and_labor_delivery_hospitals(self):
        opt = next(o for o in ranked("prov-original-specialist", True)["options"] if o["mode"] != "transit")
        self.assertIn("Plan a stop to walk and stretch at least every 1–2 hours.", opt["cautions"])
        self.assertTrue(opt["metrics"]["labor_delivery_passed"])
        self.assertTrue(any("labor & delivery" in c for c in opt["conditions"]))

    def test_never_claims_safe_in_pregnancy_mode(self):
        for pid in PROV:
            for o in ranked(pid, True)["options"]:
                text = " ".join([o["label"], *o["reasons"], *o["conditions"], *o["cautions"]]).lower()
                self.assertNotRegex(text, r"\bsafe\b|\bsafest\b")


class PregnancyEndpointTest(ServerCase):
    def test_routes_pregnancy_block(self):
        status, r = self.get("/routes?provider_id=prov-alt-best&pregnant=1")
        self.assertEqual(status, 200)
        self.assertTrue(r["pregnancy"]["tips"])
        self.assertEqual(r["pregnancy"]["labor_delivery_near_destination"][0]["name"], "Capitol Area Hospital")
        self.assertIsNone(self.get("/routes?provider_id=prov-alt-best")[1]["pregnancy"])
