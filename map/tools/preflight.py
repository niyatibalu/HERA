"""
Demo preflight: checks every HERA service the demo touches and says what to do if one is down.

    python3 map/tools/preflight.py [--backend URL] [--map URL] [--frontend URL]

Exit code 0 = the demo will work (possibly in fallback mode); 1 = the map itself is down.
"""

from __future__ import annotations

import argparse
import json
import urllib.request


def get(url: str, timeout: float = 3.0):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        body = r.read()
        try:
            return r.status, json.loads(body)
        except ValueError:
            return r.status, body


def check(name: str, fn) -> bool:
    try:
        detail = fn()
        print(f"  PASS  {name}{': ' + detail if detail else ''}")
        return True
    except Exception as e:
        print(f"  FAIL  {name}: {e}")
        return False


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--backend", default="http://127.0.0.1:8000")
    ap.add_argument("--map", default="http://127.0.0.1:8001")
    ap.add_argument("--frontend", default="http://localhost:5173")
    a = ap.parse_args()

    print("HERA demo preflight")
    backend_ok = check("backend /health", lambda: get(f"{a.backend}/health")[1]["status"])
    if backend_ok:
        check("backend Maya record", lambda: f"{len(get(f'{a.backend}/patients/maya-001/health-events')[1])} events")
        check("backend care preferences", lambda: f"clinician={get(f'{a.backend}/patients/maya-001/preferences')[1]['provider_gender']}")
        check("backend symptom log", lambda: f"{len(get(f'{a.backend}/patients/maya-001/symptom-log')[1])} notes")
        check("backend MyChart (simulated)", lambda: get(f"{a.backend}/patients/maya-001/mychart")[1]["status"])

    map_ok = check("map /health", lambda: f"backend={get(f'{a.map}/health')[1]['backend']}")

    def routes():
        r = get(f"{a.map}/routes?patient_id=maya-001&provider_id=prov-alt-best")[1]
        rec = next(o for o in r["options"] if o["recommended"])
        assert rec["route_id"] == "alt-best-beltline", f"unexpected recommendation {rec['route_id']}"
        return f"{len(r['options'])} options, recommended '{rec['name']}' ({r['data_source']} data, {r['conditions']['scenario']})"

    if map_ok:
        check("map routes for Maya → Dr. Okafor", routes)
        check("map analytics", lambda: f"{get(f'{a.map}/analytics/access')[1]['cohort']['referrals']} referrals")
        check("map page", lambda: "ok" if b"HERA Care Access Map" in get(f"{a.map}/map/")[1] else "unexpected page")
    frontend_ok = check("frontend", lambda: str(get(a.frontend)[0]))

    print()
    if not backend_ok:
        print("  → Backend down: frontend and map fall back to synthetic demo data automatically. Demo still works.")
    if not map_ok:
        print("  → Map down: start it with `cd map && HERA_DEMO_MODE=1 python3 -m hera_map.server`.")
        print("    The frontend will show sample routes meanwhile.")
    if not frontend_ok:
        print("  → Frontend down: present the map directly at", f"{a.map}/map/?provider_id=prov-alt-best")
    return 0 if map_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
