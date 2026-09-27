import unittest

from fastapi.testclient import TestClient

from app.data.store import store
from app.main import app


class SchedulingTest(unittest.TestCase):
    def setUp(self):
        store.reset()
        self.c = TestClient(app)
        self.j = self.c.get("/patients/maya-001/care-journeys").json()[0]["journey_id"]

    def advance(self, body):
        return self.c.post(f"/patients/maya-001/care-journeys/{self.j}/advance", json=body)

    def test_books_date_time_and_modality(self):
        self.advance({"state": "provider_matched", "provider_id": "prov-alt-best"})
        self.advance({"state": "records_ready"})
        j = self.advance({"state": "appointment_scheduled", "appointment_date": "2025-12-29",
                          "appointment_time": "17:30", "appointment_modality": "in_person"}).json()
        self.assertEqual((j["appointment_date"], j["appointment_time"], j["appointment_modality"]), ("2025-12-29", "17:30", "in_person"))

    def test_rejects_bad_time_or_modality(self):
        self.assertEqual(self.advance({"state": "provider_matched", "appointment_time": "25:00"}).status_code, 422)
        self.assertEqual(self.advance({"state": "provider_matched", "appointment_modality": "carrier_pigeon"}).status_code, 422)
