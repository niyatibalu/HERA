import os
import unittest

from hera_map.conditions import ConditionsSnapshot, RoadEvent, WeatherZone, clear_conditions
from hera_map.routing import route_candidates
from hera_map.scoring import FACTORS, default_weights, parse_weight_overrides, rank
from hera_map.sources import WORLD

os.environ.setdefault("HERA_DEMO_MODE", "1")
MAYA = WORLD.patients["maya-001"]
ORIGIN = (MAYA["home_location"]["lat"], MAYA["home_location"]["lon"])
PROV = {p["provider_id"]: p for p in WORLD.providers}


def ranked(provider_id, cond=None, weights=None, patient=MAYA):
    p = PROV[provider_id]
    return rank(route_candidates(patient["patient_id"], ORIGIN, p), patient, p, cond or clear_conditions(), weights or default_weights())["options"]


class ScoringTest(unittest.TestCase):
    def test_every_route_has_transparent_factors_and_one_recommendation(self):
        opts = ranked("prov-alt-best")
        driving = [o for o in opts if o["mode"] != "telehealth"]
        self.assertEqual(sum(o["recommended"] for o in opts), 1)
        for o in driving:
            self.assertTrue(0 <= o["score"] <= 100)
            for f in ("travel_time_score", "weather_score", "road_condition_score", "construction_score",
                      "isolation_score", "healthcare_proximity_score", "accessibility_score"):
                self.assertIn(f, o["factor_scores"])
            self.assertTrue(o["geometry"])
        self.assertEqual(opts[-1]["mode"], "telehealth")  # Okafor offers telehealth

    def test_deterministic(self):
        self.assertEqual(ranked("prov-original-specialist"), ranked("prov-original-specialist"))

    def test_hazards_on_fastest_route_shift_recommendation(self):
        cond = ConditionsSnapshot(
            as_of="2025-12-29",
            weather=[WeatherZone("z", "snow", 0.9, 43.068, -89.415, 1.5, "Heavy snow")],
            road_events=[RoadEvent("c", "construction", 43.0685, -89.42, 0.5, 0.6, "Regent St lane closure", road="Regent", delay_minutes=6),
                         RoadEvent("u", "unplowed", 43.066, -89.428, 0.6, 0.5, "Unplowed side streets", road="side streets")],
        )
        opts = ranked("prov-alt-best", cond)
        rec = next(o for o in opts if o["recommended"])
        fastest = next(o for o in opts if o["mode"] == "fastest")
        self.assertNotEqual(rec["route_id"], "alt-best-regent")
        self.assertTrue(fastest["construction"])
        self.assertIn("construction", " ".join(rec["reasons"]).lower())
        self.assertGreater(fastest["duration_minutes"], 8)  # delay + snow slowdown applied

    def test_closure_marks_route_and_penalizes(self):
        cond = ConditionsSnapshot(as_of="x", road_events=[RoadEvent("x", "closure", 43.04, -89.41, 1.0, 1.0, "Beltline closed", road="Beltline")])
        o = next(o for o in ranked("prov-alt-best", cond) if o["route_id"] == "alt-best-beltline")
        self.assertIn("Closure: Beltline closed", o["conditions"])
        self.assertFalse(o["recommended"])

    def test_weights_are_configurable(self):
        fast_only = {k: 0.0 for k in FACTORS} | {"travel_time": 1.0}
        rec = next(o for o in ranked("prov-alt-telehealth", weights=fast_only) if o["recommended"])
        self.assertEqual(rec["mode"], "fastest")
        self.assertEqual(parse_weight_overrides("weather:0.5, isolation:0"), {"weather": 0.5, "isolation": 0.0})
        with self.assertRaises(ValueError):
            parse_weight_overrides("vibes:1")

    def test_no_car_prefers_transit(self):
        patient = {**MAYA, "mobility_constraints": ["no_car"]}
        rec = next(o for o in ranked("prov-alt-best", patient=patient) if o["recommended"])
        self.assertEqual(rec["mode"], "transit")

    def test_wheelchair_penalizes_non_step_free_transit(self):
        patient = {**MAYA, "mobility_constraints": ["wheelchair_user"]}
        t = next(o for o in ranked("prov-alt-ok", patient=patient) if o["mode"] == "transit")
        self.assertLess(t["factor_scores"]["mobility_fit_score"], 0.2)
        self.assertEqual(t["factor_scores"]["accessibility_score"], 0.0)  # clinic not wheelchair accessible

    def test_never_claims_safe(self):
        for pid in PROV:
            for o in ranked(pid):
                text = " ".join([o["label"], *o["reasons"], *o["conditions"]]).lower()
                self.assertNotRegex(text, r"\bsafe\b|\bsafest\b")

    def test_generated_routes_for_unknown_pairs(self):
        opts = ranked("prov-pcp-02")
        self.assertTrue(any(o["generated_geometry"] for o in opts))


if __name__ == "__main__":
    unittest.main()
