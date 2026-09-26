"""
HERA access-map service. Standard library only: no pip install needed.

Run from the map/ directory:
    python3 -m hera_map.server            # http://127.0.0.1:8001/map/

Endpoints are documented in map/README.md and docs/MAP_API.md.
"""

from __future__ import annotations

import json
import logging
import mimetypes
import sys
import traceback
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from . import config
from .sources import UnknownPatient, patient_context, world_payload

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


ROUTES = {
    "/health": handle_health,
    "/world": handle_world,
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
