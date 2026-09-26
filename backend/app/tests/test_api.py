"""
Integration tests over the HTTP layer. Unlike the other test files, these
require fastapi/httpx installed (see requirements.txt) -- the engine tests
do not.
"""

import unittest

from fastapi.testclient import TestClient

from app.main import app


class TestHeraApi(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), {"status": "ok"})

    def test_unknown_patient_returns_404(self):
        resp = self.client.get("/patients/does-not-exist")
        self.assertEqual(resp.status_code, 404)

    def test_full_demo_flow_end_to_end(self):
        # 1. list + fetch patient
        patients = self.client.get("/patients").json()["patient_ids"]
        self.assertIn("maya-001", patients)
        patient = self.client.get("/patients/maya-001").json()
        self.assertEqual(patient["insurance_plan"], "MidwestCare PPO")

        # 2. health events + trend flags
        events = self.client.get("/patients/maya-001/health-events").json()
        self.assertGreaterEqual(len(events), 15)
        flags = self.client.get(
            "/patients/maya-001/trend-flags", params={"as_of": "2025-12-20"}
        ).json()
        pattern_types = {f["pattern_type"] for f in flags}
        self.assertIn("persistent_symptom", pattern_types)
        self.assertIn("unresolved_referral", pattern_types)

        # 3. provider matching routes around the inaccessible original referral
        matches = self.client.get(
            "/patients/maya-001/providers",
            params={"specialty": "chronic_pelvic_pain", "telehealth": True},
        ).json()
        self.assertEqual(matches[0]["provider"]["provider_id"], "prov-alt-best")

        # 4. care lifecycle: seeded journey exists and can advance
        journeys = self.client.get("/patients/maya-001/care-journeys").json()
        self.assertEqual(len(journeys), 1)
        journey_id = journeys[0]["journey_id"]
        advanced = self.client.post(
            f"/patients/maya-001/care-journeys/{journey_id}/advance",
            json={"state": "provider_matched"},
        ).json()
        self.assertEqual(advanced["state"], "provider_matched")

        # 5. research consent gates study matching
        before = self.client.get("/patients/maya-001/study-matches").json()
        self.assertEqual(before, [])

        self.client.post("/patients/maya-001/research-consent", json={"consent": True})

        after = self.client.get("/patients/maya-001/study-matches").json()
        self.assertEqual(len(after), 1)
        self.assertEqual(after[0]["study_id"], "study-a")
        self.assertEqual(after[0]["eligibility_status"], "potentially_eligible")
        self.assertNotIn("maya-001", after[0]["candidate_id"])

    def test_invalid_lifecycle_transition_returns_400(self):
        journeys = self.client.get("/patients/patient-002/care-journeys").json()
        # no seeded journey for patient-002 -- start one to test the guard
        started = self.client.post(
            "/patients/patient-002/care-journeys", json={"need": "test need"}
        ).json()
        journey_id = started["journey_id"]
        self.client.post(
            f"/patients/patient-002/care-journeys/{journey_id}/advance",
            json={"state": "appointment_scheduled"},
        )
        resp = self.client.post(
            f"/patients/patient-002/care-journeys/{journey_id}/advance",
            json={"state": "provider_matched"},
        )
        self.assertEqual(resp.status_code, 400)


if __name__ == "__main__":
    unittest.main()
