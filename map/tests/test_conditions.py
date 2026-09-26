import os
import unittest
from unittest import mock

from hera_map import conditions
from hera_map.conditions import UnknownScenario, get_conditions, scenario_conditions

from .test_world import ServerCase

PTS = [(43.0731, -89.4012), (43.0625, -89.4306)]


class ScenarioTest(unittest.TestCase):
    def test_winter_storm_is_default_and_deterministic(self):
        with mock.patch.dict(os.environ, {"HERA_DEMO_MODE": "1"}):
            a, b = get_conditions("2025-12-29", PTS), get_conditions("2025-12-29", PTS)
        self.assertEqual(a.to_dict(), b.to_dict())
        self.assertEqual(a.scenario, "winter_storm")
        self.assertTrue(any(z.kind == "snow" for z in a.weather))
        self.assertTrue(any(e.kind == "construction" for e in a.road_events))

    def test_unknown_scenario(self):
        with self.assertRaises(UnknownScenario):
            scenario_conditions("tornado", "x")


class LiveFallbackTest(unittest.TestCase):
    def test_live_weather_failure_falls_back_to_scenario(self):
        env = {"HERA_LIVE_WEATHER": "1", "HERA_DEMO_MODE": ""}
        with mock.patch.dict(os.environ, env), mock.patch.object(conditions, "_http_json", side_effect=OSError("offline")):
            snap = get_conditions("2025-12-29", PTS)
        self.assertTrue(snap.weather)  # demo zones kept
        self.assertIn("live weather unavailable", snap.source["weather"])

    def test_live_weather_parses_open_meteo(self):
        fake = {"daily": {"weather_code": [75], "snowfall_sum": [8.0], "precipitation_sum": [6.0], "temperature_2m_min": [-6]}}
        with mock.patch.dict(os.environ, {"HERA_LIVE_WEATHER": "1", "HERA_DEMO_MODE": ""}), mock.patch.object(conditions, "_http_json", return_value=fake):
            snap = get_conditions("2025-12-29", PTS)
        self.assertEqual(snap.source["weather"], "open-meteo")
        self.assertEqual({z.kind for z in snap.weather}, {"snow"})
        self.assertAlmostEqual(snap.weather[0].severity, 1.0)

    def test_demo_mode_overrides_live_flags(self):
        with mock.patch.dict(os.environ, {"HERA_LIVE_WEATHER": "1", "HERA_DEMO_MODE": "1"}), mock.patch.object(conditions, "_http_json") as http:
            get_conditions("2025-12-29", PTS)
        http.assert_not_called()

    def test_geojson_road_feed(self):
        fc = {"features": [{"geometry": {"type": "Point", "coordinates": [-89.41, 43.07]},
                            "properties": {"kind": "closure", "severity": 1, "label": "Bridge closed", "road": "Park"}}]}
        env = {"HERA_ROAD_EVENTS_URL": "http://feed.test/events", "HERA_DEMO_MODE": ""}
        with mock.patch.dict(os.environ, env), mock.patch.object(conditions, "_http_json", return_value=fc):
            snap = get_conditions("2025-12-29", PTS)
        self.assertEqual(snap.source["roads"], "feed")
        self.assertEqual(snap.road_events[0].label, "Bridge closed")


class RoutesEndpointTest(ServerCase):
    def test_maya_winter_storm_recommends_major_roads_over_fastest(self):
        status, r = self.get("/routes?patient_id=maya-001&provider_id=prov-alt-best")
        self.assertEqual(status, 200)
        self.assertEqual(r["appointment_date"], "2025-12-29")  # matches frontend demo appointment
        rec = next(o for o in r["options"] if o["recommended"])
        fastest = next(o for o in r["options"] if o["mode"] == "fastest")
        self.assertEqual(rec["route_id"], "alt-best-beltline")
        self.assertLess(fastest["duration_minutes"], rec["duration_minutes"])
        self.assertEqual(fastest["weather_risk"], "high")
        self.assertTrue(fastest["construction"])
        self.assertRegex(rec["reasons"][0], r"major roads.*construction")
        self.assertIn("Recommended based on current access and route conditions", r["disclaimer"])
        # Frontend RouteOption contract (frontend/src/types.ts)
        for o in r["options"]:
            for k in ("route_id", "mode", "label", "duration_minutes", "summary", "conditions", "recommended"):
                self.assertIn(k, o)
            self.assertIn(o["mode"], {"fastest", "safer", "transit", "telehealth"})

    def test_journey_only_request_defaults_to_rerouted_provider(self):
        status, r = self.get("/routes?patient_id=maya-001&journey_id=jr-specialist")
        self.assertEqual(status, 200)
        self.assertEqual(r["provider_id"], "prov-alt-best")

    def test_bad_inputs(self):
        self.assertEqual(self.get("/routes?provider_id=nope")[0], 404)
        self.assertEqual(self.get("/routes?provider_id=prov-alt-best&scenario=tornado")[0], 400)
        self.assertEqual(self.get("/routes?provider_id=prov-alt-best&weights=vibes:1")[0], 400)

    def test_conditions_endpoint(self):
        status, c = self.get("/conditions?scenario=clear")
        self.assertEqual(status, 200)
        self.assertEqual(c["weather"], [])


if __name__ == "__main__":
    unittest.main()
