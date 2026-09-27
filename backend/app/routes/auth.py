"""
Demo sign-in for the HERA web app.

One synthetic account per demo patient. Passwords are stored only as salted PBKDF2 hashes and
sessions are random bearer tokens held in memory (they reset on restart, like all demo state).
This gates the web UI for the demo; it is not production authentication (no rate limiting,
password reset, MFA, or protection on the other API routes).
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

_ITERATIONS = 200_000


def _hash(password: str, salt: bytes) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)


# Synthetic demo account. The plaintext demo password is documented in DEMO.md.
_MAYA_SALT = bytes.fromhex("5c1e0b7a2f9d4c3e8a61b0f2d7e49a13")
ACCOUNTS = {
    "maya@example.com": {
        "patient_id": "maya-001",
        "name": "Maya Restrepo",
        "salt": _MAYA_SALT,
        "hash": _hash("HeraDemo2025!", _MAYA_SALT),
    },
}

_sessions: dict[str, dict] = {}


class LoginBody(BaseModel):
    email: str
    password: str


def _public(account_email: str) -> dict:
    a = ACCOUNTS[account_email]
    return {"email": account_email, "patient_id": a["patient_id"], "name": a["name"]}


@router.post("/login")
def login(body: LoginBody):
    email = body.email.strip().lower()
    account = ACCOUNTS.get(email)
    # Compare against a dummy hash for unknown emails so timing doesn't reveal which emails exist.
    expected = account["hash"] if account else _hash("unused", b"\x00" * 16)
    ok = hmac.compare_digest(_hash(body.password, account["salt"] if account else b"\x00" * 16), expected)
    if not account or not ok:
        raise HTTPException(status_code=401, detail="Email or password is incorrect")
    token = secrets.token_urlsafe(32)
    _sessions[token] = _public(email)
    return {"token": token, **_sessions[token]}


def _token(authorization: Optional[str]) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Not signed in")
    return authorization.split(" ", 1)[1].strip()


@router.get("/me")
def me(authorization: Optional[str] = Header(default=None)):
    session = _sessions.get(_token(authorization))
    if session is None:
        raise HTTPException(status_code=401, detail="Session expired")
    return session


@router.post("/logout", status_code=204)
def logout(authorization: Optional[str] = Header(default=None)):
    _sessions.pop(_token(authorization), None)
