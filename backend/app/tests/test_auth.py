import unittest

from fastapi.testclient import TestClient

from app.main import app


class AuthTest(unittest.TestCase):
    def setUp(self):
        self.c = TestClient(app)

    def login(self, email="maya@example.com", password="HeraDemo2025!"):
        return self.c.post("/auth/login", json={"email": email, "password": password})

    def test_demo_login_session_and_logout(self):
        r = self.login(email="  Maya@Example.com ")
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual((body["patient_id"], body["name"]), ("maya-001", "Maya Restrepo"))
        auth = {"Authorization": f"Bearer {body['token']}"}
        self.assertEqual(self.c.get("/auth/me", headers=auth).json()["patient_id"], "maya-001")
        self.assertEqual(self.c.post("/auth/logout", headers=auth).status_code, 204)
        self.assertEqual(self.c.get("/auth/me", headers=auth).status_code, 401)

    def test_bad_credentials(self):
        self.assertEqual(self.login(password="wrong").status_code, 401)
        self.assertEqual(self.login(email="nobody@example.com").status_code, 401)
        self.assertEqual(self.login(password="wrong").json()["detail"], "Email or password is incorrect")

    def test_me_requires_token(self):
        self.assertEqual(self.c.get("/auth/me").status_code, 401)
        self.assertEqual(self.c.get("/auth/me", headers={"Authorization": "Bearer nope"}).status_code, 401)

    def test_password_not_stored_in_plaintext(self):
        from app.routes.auth import ACCOUNTS
        self.assertNotIn("password", ACCOUNTS["maya@example.com"])
