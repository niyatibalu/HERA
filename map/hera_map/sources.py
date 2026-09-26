"""
Patient/provider data for the map.

If HERA_API_URL points at the backend (feature/backend), patients, providers and
care journeys are read from it, following docs/API_CONTRACT.md. Any failure (backend
down, timeout, unknown shape) falls back to the synthetic snapshot in
data/demo_world.json, so the map never depends on another service being up.
"""

from __future__ import annotations

import json
import logging
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import config
from .geo import haversine_mi

log = logging.getLogger("hera_map")

DATA_DIR = Path(__file__).parent / "data"


def load_json(name: str) -> Any:
    with open(DATA_DIR / name, encoding="utf-8") as f:
        return json.load(f)


@dataclass
class PatientContext:
    patient: dict
    providers: list[dict]
    original_provider_id: str | None
    journeys: list[dict] = field(default_factory=list)
    source: str = "demo"  # "live" when read from the backend

    @property
    def origin(self) -> tuple[float, float]:
        loc = self.patient["home_location"]
        return (loc["lat"], loc["lon"])

    def provider(self, provider_id: str) -> dict | None:
        return next((p for p in self.providers if p["provider_id"] == provider_id), None)


class UnknownPatient(KeyError):
    pass


class WorldData:
    """Static synthetic geography: facilities and towns, plus snapshot patients/providers."""

    def __init__(self) -> None:
        raw = load_json("demo_world.json")
        self.patients = {p["patient_id"]: p for p in raw["patients"]}
        self.providers = raw["providers"]
        self.original_referrals = raw["original_referrals"]
        self.facilities = raw["facilities"]
        self.towns = raw["towns"]


WORLD = WorldData()


def _get(base: str, path: str) -> Any:
    req = urllib.request.Request(base + path, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=config.BACKEND_TIMEOUT_S) as res:
        return json.loads(res.read().decode("utf-8"))


def _snapshot_context(patient_id: str) -> PatientContext:
    patient = WORLD.patients.get(patient_id)
    if patient is None:
        raise UnknownPatient(patient_id)
    ref = WORLD.original_referrals.get(patient_id, {})
    return PatientContext(patient=patient, providers=WORLD.providers, original_provider_id=ref.get("provider_id"))


def _live_context(base: str, patient_id: str) -> PatientContext:
    q = urllib.parse.quote
    patient = _get(base, f"/patients/{q(patient_id)}")
    ref = WORLD.original_referrals.get(patient_id, {})
    # The backend exposes providers only through ranked matches (which include every provider).
    specialty = ref.get("specialty", "primary_care")
    matches = _get(base, f"/patients/{q(patient_id)}/providers?specialty={q(specialty)}")
    providers = [m["provider"] for m in matches]
    try:
        journeys = _get(base, f"/patients/{q(patient_id)}/care-journeys")
    except Exception:  # journeys are optional context for the map
        journeys = []
    original = ref.get("provider_id")
    if original and not any(p["provider_id"] == original for p in providers):
        original = None
    # Include any snapshot providers the backend didn't return (e.g. filtered out) so markers stay stable.
    known = {p["provider_id"] for p in providers}
    providers += [p for p in WORLD.providers if p["provider_id"] not in known]
    return PatientContext(patient=patient, providers=providers, original_provider_id=original, journeys=journeys, source="live")


def patient_context(patient_id: str) -> PatientContext:
    base = None if config.demo_mode() else config.backend_url()
    if base:
        try:
            return _live_context(base, patient_id)
        except urllib.error.HTTPError as e:
            if e.code == 404 and patient_id not in WORLD.patients:
                raise UnknownPatient(patient_id) from e
            log.warning("backend error %s for %s; using demo snapshot", e.code, patient_id)
        except Exception as e:  # network down, timeout, bad JSON
            log.warning("backend unavailable (%s); using demo snapshot", e)
    return _snapshot_context(patient_id)


def provider_for_journey(ctx: PatientContext, journey_id: str | None) -> str | None:
    """Provider the patient is currently travelling to for a journey, if one is known."""
    if not journey_id:
        return None
    j = next((j for j in ctx.journeys if j.get("journey_id") == journey_id), None)
    if j and j.get("provider_id") and ctx.provider(j["provider_id"]):
        return j["provider_id"]
    return None


def world_payload(ctx: PatientContext) -> dict:
    """Everything the map needs to draw markers for one patient."""
    origin = ctx.origin
    providers = []
    for p in ctx.providers:
        loc = (p["location"]["lat"], p["location"]["lon"])
        role = "original" if p["provider_id"] == ctx.original_provider_id else "alternative"
        providers.append({**p, "role": role, "distance_mi": round(haversine_mi(origin, loc), 1)})
    providers.sort(key=lambda p: (p["role"] != "original", p["distance_mi"]))
    return {
        "patient": {
            "patient_id": ctx.patient["patient_id"],
            "name": ctx.patient.get("name"),
            "insurance_plan": ctx.patient.get("insurance_plan"),
            "home_location": ctx.patient["home_location"],
            "mobility_constraints": ctx.patient.get("mobility_constraints", []),
            "accessibility_needs": ctx.patient.get("accessibility_needs", []),
        },
        "original_provider_id": ctx.original_provider_id,
        "providers": providers,
        "facilities": WORLD.facilities,
        "towns": WORLD.towns,
        "data_source": ctx.source,
    }
