"""
HERA access-map service. Standard library only: no pip install needed.

Run from the map/ directory:
    python3 -m hera_map.server            # http://127.0.0.1:8001/map/

Endpoints are documented in map/README.md and docs/MAP_API.md.
"""

from __future__ import annotations

import json
from datetime import date, timedelta
import logging
import mimetypes
import sys
import traceback
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import config
from .analytics import access_analytics
from .conditions import UnknownScenario, get_conditions, scenario_names
from .geo import haversine_mi
from .routing import route_candidates
from .scoring import RECOMMENDATION_NOTE, default_weights, parse_weight_overrides, rank
from .sources import WORLD, UnknownPatient, patient_context, provider_for_journey, world_payload

log = logging.getLogger("hera_map")

WEB_DIR = (Path(__file__).parent.parent / "web").resolve()


class ApiError(Exception):
    def __init__(self, status: int, detail: str):
        super().__init__(detail)
        self.status = status
        self.detail = detail


def _one(qs: dict[str, list[str]], key: str, default: str | None = None) -> str | None:
    v = qs.get(key)
    return v[0] if v and v[0] != "" else default


def _require(qs: dict[str, list[str]], key: str) -> str:
    v = _one(qs, key)
    if v is None:
        raise ApiError(400, f"missing required query parameter '{key}'")
    return v


def handle_health(qs):
    return {"status": "ok", "service": "hera-map", "demo_mode": config.demo_mode(), "backend": config.backend_url()}


def handle_world(qs):
    ctx = patient_context(_one(qs, "patient_id", "maya-001"))
    return world_payload(ctx)


def load_conditions(qs, as_of: str, points):
    try:
        return get_conditions(as_of, points, _one(qs, "scenario"))
    except UnknownScenario as e:
        raise ApiError(400, f"unknown scenario '{e.args[0]}'; expected one of {', '.join(scenario_names())}")


def handle_conditions(qs):
    ctx = patient_context(_one(qs, "patient_id", "maya-001"))
    return load_conditions(qs, _one(qs, "date", config.demo_today()), [ctx.origin]).to_dict()


def handle_routes(qs):
    patient_id = _one(qs, "patient_id", "maya-001")
    journey_id = _one(qs, "journey_id")
    ctx = patient_context(patient_id)
    provider_id = _one(qs, "provider_id") or provider_for_journey(ctx, journey_id)
    if not provider_id:
        # Journeys from the backend don't carry the newly selected provider yet; in the demo the
        # patient reroutes to the top-ranked accessible alternative.
        provider_id = "prov-alt-best" if ctx.provider("prov-alt-best") else ctx.original_provider_id
    provider = ctx.provider(provider_id) if provider_id else None
    if provider is None:
        raise ApiError(404, f"provider '{provider_id}' not found")
    try:
        weights = {**default_weights(), **parse_weight_overrides(_one(qs, "weights"))}
    except ValueError as e:
        raise ApiError(400, str(e))

    try:
        today = date.fromisoformat(_one(qs, "date", config.demo_today()))
    except ValueError:
        raise ApiError(400, "date must be YYYY-MM-DD")
    appointment = today + timedelta(days=int(provider.get("wait_days", 0)))
    origin = ctx.origin
    dest = (provider["location"]["lat"], provider["location"]["lon"])
    mid = ((origin[0] + dest[0]) / 2, (origin[1] + dest[1]) / 2)
    cond = load_conditions(qs, appointment.isoformat(), [origin, mid, dest])
    pregnant = (_one(qs, "pregnant", "") or "").lower() in {"1", "true", "yes"}
    result = rank(route_candidates(ctx.patient["patient_id"], origin, provider), ctx.patient, provider, cond, weights, today, pregnant)

    nearby = sorted(
        ({**f, "distance_from_destination_mi": round(haversine_mi(dest, (f["lat"], f["lon"])), 1)} for f in WORLD.facilities),
        key=lambda f: f["distance_from_destination_mi"],
    )[:5]
    return {
        "patient_id": ctx.patient["patient_id"],
        "journey_id": journey_id,
        "provider_id": provider["provider_id"],
        "destination": f"{provider['name']} — {provider['location'].get('address', '')}".rstrip(" —"),
        "destination_detail": {
            "provider_id": provider["provider_id"],
            "name": provider["name"],
            "specialty": provider.get("specialty"),
            "location": provider["location"],
            "accessibility_features": provider.get("accessibility_features", []),
            "telehealth_available": provider.get("telehealth_available", False),
            "is_original_referral": provider["provider_id"] == ctx.original_provider_id,
        },
        "origin": ctx.patient["home_location"],
        "appointment_date": appointment.isoformat(),
        "options": result["options"],
        "weights": result["weights"],
        "conditions": cond.to_dict(),
        "nearby_resources": nearby,
        "data_source": ctx.source,
        "disclaimer": RECOMMENDATION_NOTE,
        "pregnancy": pregnancy_block(dest) if pregnant else None,
    }


# General travel guidance commonly given for pregnancy (e.g. by ACOG and CDC). Not personal medical advice.
PREGNANCY_TIPS = [
    "Wear the lap belt low across your hips, under your belly, with the shoulder belt across your chest.",
    "On drives over an hour or two, stop to walk and stretch, and drink water, to lower the risk of blood clots.",
    "Bring your prenatal records or have them on your phone.",
    "Know where the nearest hospital with labor & delivery care is along your route.",
    "Take extra care on icy or wet walkways; balance changes during pregnancy.",
    "Ask your clinician before long trips, especially late in pregnancy.",
]


def pregnancy_block(dest) -> dict:
    ld = [f for f in WORLD.facilities if "labor_delivery" in f.get("services", [])]
    nearest = sorted(ld, key=lambda f: haversine_mi(dest, (f["lat"], f["lon"])))[:2]
    return {
        "tips": PREGNANCY_TIPS,
        "labor_delivery_near_destination": [
            {"name": f["name"], "distance_mi": round(haversine_mi(dest, (f["lat"], f["lon"])), 1)} for f in nearest
        ],
        "note": "General travel guidance for pregnancy. Ask your clinician about your situation.",
    }


def handle_analytics(qs):
    return access_analytics(_one(qs, "region_type"), _one(qs, "specialty"), _one(qs, "region"))


ROUTES = {
    "/health": handle_health,
    "/world": handle_world,
    "/routes": handle_routes,
    "/conditions": handle_conditions,
    "/analytics/access": handle_analytics,
}


class Handler(BaseHTTPRequestHandler):
    server_version = "HERAMap/0.1"

    def log_message(self, fmt, *args):  # quieter, single-line logs
        log.info("%s %s", self.address_string(), fmt % args)

    def _send(self, status: int, body: bytes, content_type: str):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        # Hackathon demo: open CORS so the frontend can call from any localhost port.
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _json(self, status: int, payload) -> None:
        self._send(status, json.dumps(payload).encode("utf-8"), "application/json")

    def do_OPTIONS(self):
        self._send(204, b"", "text/plain")

    def do_HEAD(self):
        self.do_GET()

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        path = url.path.rstrip("/") or "/"
        qs = urllib.parse.parse_qs(url.query)
        if path == "/":
            self.send_response(302)
            self.send_header("Location", "/map/")
            self.end_headers()
            return
        if path == "/map" or url.path.startswith("/map/"):
            return self._static(url.path[len("/map"):] or "/")
        fn = ROUTES.get(path)
        if fn is None:
            return self._json(404, {"detail": f"no route {path}"})
        try:
            self._json(200, fn(qs))
        except ApiError as e:
            self._json(e.status, {"detail": e.detail})
        except UnknownPatient as e:
            self._json(404, {"detail": f"patient '{e.args[0]}' not found"})
        except Exception as e:
            traceback.print_exc()
            self._json(500, {"detail": f"internal error: {e}"})

    def _static(self, rel: str):
        if rel.endswith("/"):
            rel += "index.html"
        target = (WEB_DIR / rel.lstrip("/")).resolve()
        if not target.is_relative_to(WEB_DIR) or not target.is_file():
            return self._json(404, {"detail": "not found"})
        ctype = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self._send(200, target.read_bytes(), ctype)


def make_server(host: str = config.HOST, port: int = config.PORT) -> ThreadingHTTPServer:
    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="[hera-map] %(message)s")
    srv = make_server()
    host, port = srv.server_address[:2]
    mode = "DEMO (synthetic, offline-safe)" if config.demo_mode() or not config.backend_url() else f"backend {config.backend_url()} with demo fallback"
    print(f"HERA access map on http://{host}:{port}/map/  ·  data: {mode}", file=sys.stderr)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
