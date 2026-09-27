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


class CancelAppointmentTest(unittest.TestCase):
    def setUp(self):
        store.reset()
        self.c = TestClient(app)
        self.j = self.c.get("/patients/maya-001/care-journeys").json()[0]["journey_id"]
        self.url = f"/patients/maya-001/care-journeys/{self.j}"

    def book(self):
        for body in ({"state": "provider_matched", "provider_id": "prov-alt-best"}, {"state": "records_ready"},
                     {"state": "appointment_scheduled", "appointment_date": "2025-12-29", "appointment_time": "17:30", "appointment_modality": "in_person"}):
            self.c.post(f"{self.url}/advance", json=body)

    def test_cancel_clears_appointment_and_allows_rebooking(self):
        self.book()
        j = self.c.post(f"{self.url}/cancel-appointment", json={"reason": "Schedule conflict"}).json()
        self.assertEqual(j["state"], "records_ready")
        self.assertIsNone(j["appointment_date"])
        self.assertIsNone(j["appointment_time"])
        self.assertEqual(j["provider_id"], "prov-alt-best")
        self.assertEqual(j["state_history"][-1]["note"], "Appointment cancelled: Schedule conflict")
        again = self.c.post(f"{self.url}/advance", json={"state": "appointment_scheduled", "appointment_date": "2025-12-30", "appointment_time": "13:30"})
        self.assertEqual(again.status_code, 200)
        self.assertEqual(again.json()["appointment_date"], "2025-12-30")

    def test_cannot_cancel_without_booking(self):
        r = self.c.post(f"{self.url}/cancel-appointment")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.c.post("/patients/maya-001/care-journeys/nope/cancel-appointment").status_code, 404)
