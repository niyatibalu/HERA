import unittest

from fastapi.testclient import TestClient

from app.data.providers import PROVIDERS
from app.data.store import store
from app.data.synthetic_patients import PATIENTS
from app.engine.matching import MatchRequest, ProviderMatchingEngine
from app.main import app
from app.models.preferences import CarePreferences

MAYA = PATIENTS["maya-001"]


def rank(prefs: CarePreferences | None):
    req = MatchRequest(required_specialty="chronic_pelvic_pain", preferences=prefs)
    return ProviderMatchingEngine().rank(MAYA, list(PROVIDERS.values()), req)


def by_id(results):
    return {m.provider.provider_id: m for m in results}


class PreferenceMatchingTest(unittest.TestCase):
    def test_unset_preferences_do_not_change_ranking(self):
        self.assertEqual([m.provider.provider_id for m in rank(None)],
                         [m.provider.provider_id for m in rank(CarePreferences(patient_id="maya-001"))])

    def test_gender_preference(self):
        male = by_id(rank(CarePreferences(patient_id="maya-001", provider_gender="male")))
        female = by_id(rank(CarePreferences(patient_id="maya-001", provider_gender="female")))
        self.assertGreater(male["prov-alt-ok"].score, female["prov-alt-ok"].score)
        self.assertIn("Not a female clinician (your preference)", female["prov-alt-ok"].access_tradeoffs)

    def test_budget_and_financial_assistance(self):
        r = by_id(rank(CarePreferences(patient_id="maya-001", max_cost_usd=100, needs_financial_assistance=True)))
        self.assertIn("Within your budget: $95 per visit", r["prov-alt-best"].match_reasons)
        self.assertIn("Offers sliding-scale fees / financial assistance", r["prov-alt-best"].match_reasons)
        self.assertTrue(any("Above your $100 budget" in t for t in r["prov-alt-ok"].access_tradeoffs))

    def test_schedule_expertise_reviews_and_distance(self):
        prefs = CarePreferences(patient_id="maya-001", availability=["weekend"], expertise=["endometriosis"],
                                min_rating=4.5, max_distance_mi=10)
        r = by_id(rank(prefs))
        self.assertIn("No appointments at the times you said you're free", r["prov-alt-best"].access_tradeoffs)
        self.assertTrue(any("weekends" in x for x in r["prov-alt-telehealth"].match_reasons))
        self.assertTrue(any("endometriosis" in x for x in r["prov-original-specialist"].match_reasons))
        self.assertTrue(any("below your minimum" in t for t in r["prov-alt-ok"].access_tradeoffs))
        self.assertTrue(any("10 mi travel limit" in t for t in r["prov-alt-telehealth"].access_tradeoffs))

    def test_telehealth_preference_waives_travel_limit(self):
        r = by_id(rank(CarePreferences(patient_id="maya-001", max_distance_mi=10, telehealth="prefer_telehealth")))
        self.assertFalse(any("travel limit" in t for t in r["prov-alt-telehealth"].access_tradeoffs))

    def test_insurance_override(self):
        r = by_id(rank(CarePreferences(patient_id="maya-001", insurance_plan="MidwestCare HMO")))
        self.assertIn("In-network for MidwestCare HMO", r["prov-pcp-02"].match_reasons)

    def test_scores_stay_in_range(self):
        for m in rank(CarePreferences(patient_id="maya-001", provider_gender="female", availability=["weekday_evening"])):
            self.assertTrue(0 <= m.score <= 100)


class ApiTest(unittest.TestCase):
    def setUp(self):
        store.reset()
        self.c = TestClient(app)

    def test_preferences_roundtrip_and_affect_matching(self):
        prefs = self.c.get("/patients/maya-001/preferences").json()
        self.assertEqual(prefs["provider_gender"], "female")
        body = {"provider_gender": "male", "availability": ["weekday_morning", "weekday_morning"]}
        saved = self.c.put("/patients/maya-001/preferences", json=body).json()
        self.assertEqual(saved["availability"], ["weekday_morning"])
        self.assertEqual(saved["updated_at"], "2025-12-17")
        matches = self.c.get("/patients/maya-001/providers?specialty=chronic_pelvic_pain").json()
        chen = next(m for m in matches if m["provider"]["provider_id"] == "prov-alt-ok")
        self.assertIn("Matches your preference for a male clinician", chen["match_reasons"])
        self.assertEqual(chen["provider"]["gender"], "male")

    def test_preferences_validation(self):
        self.assertEqual(self.c.put("/patients/maya-001/preferences", json={"provider_gender": "robot"}).status_code, 422)
        self.assertEqual(self.c.put("/patients/maya-001/preferences", json={"min_rating": 9}).status_code, 422)
        self.assertEqual(self.c.put("/patients/maya-001/preferences", json={"availability": ["midnight"]}).status_code, 422)
        self.assertEqual(self.c.get("/patients/nobody/preferences").status_code, 404)

    def test_symptom_log_crud(self):
        log = self.c.get("/patients/maya-001/symptom-log").json()
        self.assertEqual(len(log), 5)
        self.assertGreaterEqual(log[0]["logged_on"], log[-1]["logged_on"])  # newest first
        r = self.c.post("/patients/maya-001/symptom-log", json={
            "symptom": " Pelvic pain ", "severity": 5, "timing": "after_visit",
            "visit": "Dr. Okafor · Dec 29", "note": "Started pelvic floor exercises."})
        self.assertEqual(r.status_code, 201)
        entry = r.json()
        self.assertEqual((entry["symptom"], entry["logged_on"]), ("Pelvic pain", "2025-12-17"))
        self.assertEqual(self.c.delete(f"/patients/maya-001/symptom-log/{entry['entry_id']}").status_code, 204)
        self.assertEqual(self.c.delete(f"/patients/maya-001/symptom-log/{entry['entry_id']}").status_code, 404)
        self.assertEqual(len(self.c.get("/patients/maya-001/symptom-log").json()), 5)

    def test_symptom_log_validation(self):
        post = lambda body: self.c.post("/patients/maya-001/symptom-log", json=body).status_code
        self.assertEqual(post({"symptom": "Pain", "severity": 11}), 422)
        self.assertEqual(post({"symptom": "   ", "severity": 3}), 422)
        self.assertEqual(post({"symptom": "Pain", "severity": 3, "timing": "someday"}), 422)
        general = self.c.post("/patients/maya-001/symptom-log", json={"symptom": "Pain", "severity": 3, "visit": "x"}).json()
        self.assertIsNone(general["visit"])  # general notes aren't tied to a visit

    def test_mychart_connect_and_disconnect(self):
        self.assertEqual(self.c.get("/patients/maya-001/mychart").json()["status"], "not_connected")
        conn = self.c.post("/patients/maya-001/mychart/connect").json()
        self.assertEqual(conn["status"], "connected")
        self.assertTrue(conn["simulated"])
        self.assertEqual(sum(conn["imported"].values()), len(self.c.get("/patients/maya-001/health-events").json()))
        self.assertEqual(len(conn["organizations"]), 3)
        self.assertEqual(self.c.post("/patients/maya-001/mychart/connect", json={"scopes": ["passwords"]}).status_code, 400)
        self.assertEqual(self.c.post("/patients/maya-001/mychart/disconnect").json()["status"], "not_connected")


if __name__ == "__main__":
    unittest.main()


class PreferencesChangeWhoRanksFirstTest(unittest.TestCase):
    """Changing a preference should visibly change the top recommendation."""

    SKIP = {"prov-original-specialist", "prov-pcp-01", "prov-pcp-02", "prov-obgyn-01"}

    def top(self, **changes):
        prefs = CarePreferences(
            patient_id="maya-001", max_cost_usd=150, needs_financial_assistance=True, max_distance_mi=30,
            expertise=["chronic_pelvic_pain", "endometriosis"], min_rating=4.0,
            availability=["weekday_afternoon", "weekday_evening"], provider_gender="female",
        )
        for k, v in changes.items():
            setattr(prefs, k, v)
        return next(m for m in rank(prefs) if m.provider.provider_id not in self.SKIP)

    def test_default_demo_preferences_pick_okafor(self):
        self.assertEqual(self.top().provider.provider_id, "prov-alt-best")

    def test_expertise_changes_the_top_specialist(self):
        self.assertEqual(self.top(expertise=["reproductive_endocrinology"]).provider.provider_id, "prov-rei-madison")
        self.assertEqual(self.top(expertise=["urogynecology"]).provider.provider_id, "prov-urogyn-madison")
        self.assertEqual(self.top(expertise=["general_gynecology"]).provider.specialty, "gynecology")
        top = self.top(expertise=["reproductive_endocrinology"])
        self.assertIn("Expertise you asked for: reproductive endocrinology", top.match_reasons)

    def test_unmatched_expertise_is_explained(self):
        r = by_id(rank(CarePreferences(patient_id="maya-001", expertise=["urogynecology"])))
        self.assertTrue(any("Not a match for urogynecology" in t for t in r["prov-alt-best"].access_tradeoffs))

    def test_gender_changes_the_top_provider(self):
        self.assertEqual(self.top(provider_gender="male").provider.gender, "male")
        self.assertEqual(self.top(provider_gender="nonbinary").provider.gender, "nonbinary")

    def test_language_counts(self):
        r = by_id(rank(None))
        self.assertGreater(r["prov-alt-best"].score, 0)
        self.assertIn("No confirmed es language support", r["prov-pfpt-madison"].access_tradeoffs)


class PregnancyPreferenceTest(unittest.TestCase):
    def test_pregnant_favors_experienced_clinicians(self):
        r = by_id(rank(CarePreferences(patient_id="maya-001", pregnant=True)))
        self.assertIn("Experienced caring for pregnant patients", r["prov-alt-best"].match_reasons)
        self.assertIn("Not listed as experienced with pregnant patients", r["prov-endo-madison"].access_tradeoffs)
        base = by_id(rank(CarePreferences(patient_id="maya-001")))
        self.assertLess(r["prov-endo-madison"].score, base["prov-endo-madison"].score)
        self.assertEqual(r["prov-alt-best"].score, base["prov-alt-best"].score)

    def test_pregnant_roundtrips_through_api(self):
        store.reset()
        c = TestClient(app)
        prefs = c.get("/patients/maya-001/preferences").json()
        self.assertFalse(prefs["pregnant"])
        body = {k: v for k, v in prefs.items() if k not in ("patient_id", "updated_at")} | {"pregnant": True}
        self.assertTrue(c.put("/patients/maya-001/preferences", json=body).json()["pregnant"])
