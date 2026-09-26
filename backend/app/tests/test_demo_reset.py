import unittest

from fastapi.testclient import TestClient

from app.data.store import store
from app.main import app


class DemoResetTest(unittest.TestCase):
    def test_reset_restores_seeded_state(self):
        c = TestClient(app)
        store.reset()
        c.post("/patients/maya-001/mychart/connect")
        c.post("/patients/maya-001/symptom-log", json={"symptom": "Pain", "severity": 3})
        self.assertEqual(c.post("/demo/reset").json(), {"status": "reset"})
        self.assertEqual(c.get("/patients/maya-001/mychart").json()["status"], "not_connected")
        self.assertEqual(len(c.get("/patients/maya-001/symptom-log").json()), 5)
        self.assertEqual(c.get("/patients/maya-001/care-journeys").json()[0]["state"], "need_identified")
