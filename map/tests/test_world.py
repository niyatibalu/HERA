import json
import os
import threading
import unittest
import urllib.error
import urllib.request

from hera_map import geo
from hera_map.server import make_server
from hera_map.sources import patient_context, world_payload


class ServerCase(unittest.TestCase):
    """Starts the real HTTP server on an ephemeral port, in demo mode."""

    @classmethod
    def setUpClass(cls):
        cls._env = {k: os.environ.get(k) for k in ("HERA_DEMO_MODE", "HERA_API_URL")}
        os.environ["HERA_DEMO_MODE"] = "1"
        os.environ.pop("HERA_API_URL", None)
        cls.srv = make_server("127.0.0.1", 0)
        cls.base = f"http://127.0.0.1:{cls.srv.server_address[1]}"
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()
        for k, v in cls._env.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def get(self, path):
        try:
            with urllib.request.urlopen(self.base + path, timeout=5) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())


class GeoTest(unittest.TestCase):
    def test_haversine_madison_chicago(self):
        d = geo.haversine_mi((43.0731, -89.4012), (41.8781, -87.6298))
        self.assertAlmostEqual(d, 122.3, delta=0.5)  # matches backend distance_mi for the original referral

    def test_point_to_polyline(self):
        line = [(43.0, -89.5), (43.0, -89.3)]
        self.assertLess(geo.point_polyline_distance_mi((43.0, -89.4), line), 0.01)
        self.assertAlmostEqual(geo.point_polyline_distance_mi((43.0145, -89.4), line), 1.0, delta=0.05)


class WorldTest(ServerCase):
    def test_world_has_markers_for_maya(self):
        status, w = self.get("/world?patient_id=maya-001")
        self.assertEqual(status, 200)
        self.assertEqual(w["patient"]["patient_id"], "maya-001")
        self.assertEqual(w["original_provider_id"], "prov-original-specialist")
        roles = {p["provider_id"]: p["role"] for p in w["providers"]}
        self.assertEqual(roles["prov-original-specialist"], "original")
        self.assertEqual(roles["prov-alt-best"], "alternative")
        self.assertEqual(w["providers"][0]["provider_id"], "prov-original-specialist")
        self.assertGreater(len(w["facilities"]), 5)
        self.assertEqual(w["data_source"], "demo")

    def test_unknown_patient_404(self):
        status, body = self.get("/world?patient_id=nobody")
        self.assertEqual(status, 404)
        self.assertIn("nobody", body["detail"])

    def test_health_and_static_map(self):
        self.assertEqual(self.get("/health")[1]["status"], "ok")
        with urllib.request.urlopen(self.base + "/map/", timeout=5) as r:
            self.assertIn(b"HERA Care Access Map", r.read())
        with urllib.request.urlopen(self.base + "/map/vendor/leaflet/leaflet.js", timeout=5) as r:
            self.assertEqual(r.status, 200)

    def test_static_path_traversal_blocked(self):
        status, _ = self.get("/map/../hera_map/config.py")
        self.assertEqual(status, 404)


class BackendFallbackTest(unittest.TestCase):
    def test_unreachable_backend_falls_back_to_snapshot(self):
        old = {k: os.environ.get(k) for k in ("HERA_DEMO_MODE", "HERA_API_URL")}
        os.environ.pop("HERA_DEMO_MODE", None)
        os.environ["HERA_API_URL"] = "http://127.0.0.1:9"  # nothing listens here
        try:
            ctx = patient_context("maya-001")
            self.assertEqual(ctx.source, "demo")
            self.assertEqual(world_payload(ctx)["original_provider_id"], "prov-original-specialist")
        finally:
            for k, v in old.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v


if __name__ == "__main__":
    unittest.main()
