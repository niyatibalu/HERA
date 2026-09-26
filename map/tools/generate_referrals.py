"""
Generate the SYNTHETIC referral cohort used by access analytics.

    cd map && python3 tools/generate_referrals.py

Writes hera_map/data/synthetic_referrals.json. Seeded, so re-running produces the same
file. Every record is fabricated: no real patients, providers or referrals.
"""

from __future__ import annotations

import json
import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from hera_map.geo import haversine_mi  # noqa: E402

SEED = 2025
N = 320
OUT = Path(__file__).resolve().parent.parent / "hera_map" / "data" / "synthetic_referrals.json"

# (name, lat, lon, region_type, weight, has_transit)
REGIONS = [
    ("Madison", 43.0731, -89.4012, "urban", 22, True),
    ("Milwaukee", 43.0389, -87.9065, "urban", 20, True),
    ("Rockford", 42.2711, -89.0940, "urban", 8, True),
    ("Sun Prairie", 43.1836, -89.2137, "suburban", 6, False),
    ("Middleton", 43.0972, -89.5043, "suburban", 5, True),
    ("Waukesha", 43.0117, -88.2315, "suburban", 7, True),
    ("Janesville", 42.6828, -89.0187, "suburban", 7, True),
    ("Beloit", 42.5083, -89.0318, "suburban", 5, True),
    ("Portage", 43.5391, -89.4626, "rural", 4, False),
    ("Baraboo", 43.4711, -89.7443, "rural", 4, False),
    ("Dodgeville", 42.9603, -90.1301, "rural", 4, False),
    ("Monroe", 42.6011, -89.6385, "rural", 4, False),
    ("Richland Center", 43.3347, -90.3865, "rural", 3, False),
    ("Platteville", 42.7342, -90.4785, "rural", 3, False),
    ("Reedsburg", 43.5325, -90.0026, "rural", 3, False),
    ("Fort Atkinson", 42.9289, -88.8371, "rural", 3, False),
]

# Where women's-health specialists practice in this synthetic world.
SPECIALIST_SITES = {
    "academic": [("Chicago", 41.8781, -87.6298), ("Madison", 43.0731, -89.4012), ("Milwaukee", 43.0389, -87.9065)],
    "community": [("Madison", 43.0625, -89.4306), ("Milwaukee", 43.05, -87.95), ("Rockford", 42.27, -89.09),
                  ("Janesville", 42.68, -89.02), ("Waukesha", 42.9633, -88.0034), ("Baraboo", 43.47, -89.74)],
}
SPECIALTIES = [
    ("chronic_pelvic_pain", 0.3), ("endometriosis", 0.2), ("maternal_fetal_medicine", 0.15),
    ("reproductive_endocrinology", 0.15), ("pelvic_floor_physical_therapy", 0.2),
]
PLANS = [("MidwestCare PPO", 0.45), ("MidwestCare HMO", 0.3), ("BadgerCare Medicaid", 0.2), ("Uninsured", 0.05)]
STATES = ["need_identified", "provider_matched", "records_ready", "appointment_scheduled", "travel_planned", "appointment_completed", "followup_required", "followup_completed"]


def pick(rng, pairs):
    return rng.choices([p for p, _ in pairs], weights=[w for _, w in pairs])[0]


def main() -> None:
    rng = random.Random(SEED)
    start = date(2025, 1, 6)
    records = []
    for i in range(N):
        name, lat, lon, rtype, _, transit = rng.choices(REGIONS, weights=[r[4] for r in REGIONS])[0]
        jitter = 0.04 if rtype != "rural" else 0.12
        home = (round(lat + rng.uniform(-jitter, jitter), 4), round(lon + rng.uniform(-jitter, jitter), 4))
        plan = pick(rng, PLANS)
        specialty = pick(rng, SPECIALTIES)

        # Original referral: usually to an academic center, often not the closest.
        academic = sorted(SPECIALIST_SITES["academic"], key=lambda s: haversine_mi(home, s[1:]))
        if rng.random() < 0.7:
            site = academic[0] if rng.random() < 0.55 else rng.choice(academic[1:])
        else:
            site = rng.choice(SPECIALIST_SITES["community"])
        nearest_mi = round(min(haversine_mi(home, s[1:]) for group in SPECIALIST_SITES.values() for s in group) * 1.2, 1)
        orig_dist = round(haversine_mi(home, site[1:]) * 1.2, 1)
        orig = {
            "site": site[0],
            "distance_mi": orig_dist,
            "wait_days": rng.randint(35, 95) if site in SPECIALIST_SITES["academic"] else rng.randint(10, 45),
            "in_network": plan != "Uninsured" and rng.random() < (0.55 if plan == "BadgerCare Medicaid" else 0.7),
            "estimated_cost_usd": rng.choice([180, 240, 320, 420, 520]),
        }

        barriers = []
        if orig["distance_mi"] > 30:
            barriers.append("distance")
        if orig["wait_days"] > 30:
            barriers.append("wait_time")
        if not orig["in_network"]:
            barriers.append("insurance")
        if orig["estimated_cost_usd"] >= 400:
            barriers.append("cost")
        month = rng.randint(0, 10)
        referred_at = start + timedelta(days=month * 30 + rng.randint(0, 25))
        winter = referred_at.month in (1, 2, 3, 11, 12)
        route_weather = "high" if winter and rng.random() < 0.45 else "moderate" if winter else "low"
        if route_weather == "high":
            barriers.append("weather")
        if not transit:
            barriers.append("no_public_transit")
        if rtype == "rural" and orig["distance_mi"] > 40 and rng.random() < 0.6:
            barriers.append("isolated_route")
        if rng.random() < 0.12:
            barriers.append("construction")
        if rng.random() < 0.08:
            barriers.append("mobility")

        # HERA rerouting applies when there is a barrier and HERA was used for this referral.
        used_hera = rng.random() < 0.62
        rerouted = used_hera and any(b in barriers for b in ("distance", "wait_time", "insurance", "cost"))
        if rerouted:
            nearest = min(SPECIALIST_SITES["community"], key=lambda s: haversine_mi(home, s[1:]))
            tele = rtype == "rural" and rng.random() < 0.45 or "mobility" in barriers and rng.random() < 0.6
            final = {
                "site": "telehealth" if tele else nearest[0],
                "distance_mi": 0.0 if tele else round(haversine_mi(home, nearest[1:]) * 1.2, 1),
                "wait_days": rng.randint(4, 14) if tele else rng.randint(8, 24),
                "in_network": plan != "Uninsured",
                "estimated_cost_usd": rng.choice([70, 95, 120, 140]),
                "mode": "telehealth" if tele else "in_person",
            }
        else:
            tele = used_hera and rng.random() < 0.1
            final = {**orig, "mode": "telehealth" if tele else "in_person"}
            if tele:
                final["distance_mi"] = 0.0

        # Care progression: unresolved barriers stall pathways more often.
        unresolved = len([b for b in barriers if b in ("distance", "wait_time", "insurance", "cost")]) if not rerouted else 0
        stall_p = 0.08 + 0.14 * unresolved + (0.08 if "no_public_transit" in barriers and final["mode"] == "in_person" else 0)
        stalled = rng.random() < min(0.75, stall_p)
        if stalled:
            state = rng.choice(STATES[:5])
            stalled_days = rng.randint(9, 75)
        else:
            state = rng.choices(STATES[3:], weights=[1, 1, 3, 2, 5])[0]
            stalled_days = 0
        records.append({
            "referral_id": f"ref-{i + 1:04d}",
            "region": name,
            "region_type": rtype,
            "home": {"lat": home[0], "lon": home[1]},
            "insurance_plan": plan,
            "specialty": specialty,
            "referred_at": referred_at.isoformat(),
            "used_hera": used_hera,
            "rerouted": rerouted,
            "original": orig,
            "final": final,
            "barriers": barriers,
            "route_weather_risk": route_weather,
            "public_transit_available": transit,
            "nearest_specialist_mi": nearest_mi,
            "state": state,
            "stalled": stalled,
            "stalled_days": stalled_days,
        })
    OUT.write_text(json.dumps({"_comment": "SYNTHETIC referral cohort generated by map/tools/generate_referrals.py (seed %d). Not real patients." % SEED, "referrals": records}, indent=1) + "\n")
    print(f"wrote {len(records)} referrals to {OUT}")


if __name__ == "__main__":
    main()
