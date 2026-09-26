"""
Population-level access analytics over the synthetic referral cohort.

Everything here is aggregate: no record identifiers leave this module, and regions
with fewer than MIN_CELL referrals are suppressed so small groups can't be singled out.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from statistics import mean

from .sources import load_json

FAR_MI = 30
LONG_WAIT_DAYS = 30
MIN_CELL = 5
BARRIER_LABELS = {
    "distance": f"Care more than {FAR_MI} mi away",
    "wait_time": f"Wait longer than {LONG_WAIT_DAYS} days",
    "insurance": "Out of network",
    "cost": "High estimated cost",
    "weather": "High winter-weather route risk",
    "no_public_transit": "No public transit",
    "isolated_route": "Isolated rural route",
    "construction": "Construction on route",
    "mobility": "Mobility / accessibility need",
}

_REFERRALS: list[dict] | None = None


def referrals() -> list[dict]:
    global _REFERRALS
    if _REFERRALS is None:
        _REFERRALS = load_json("synthetic_referrals.json")["referrals"]
    return _REFERRALS


def _avg(xs, nd=1):
    xs = list(xs)
    return round(mean(xs), nd) if xs else None


def _pct(n, d):
    return round(100 * n / d, 1) if d else 0.0


def access_analytics(region_type: str | None = None, specialty: str | None = None, region: str | None = None) -> dict:
    rs = [r for r in referrals()
          if (not region_type or r["region_type"] == region_type)
          and (not specialty or r["specialty"] == specialty)
          and (not region or r["region"].lower() == region.lower())]
    n = len(rs)
    in_person_final = [r for r in rs if r["final"]["mode"] == "in_person"]
    rerouted = [r for r in rs if r["rerouted"]]
    stalled = [r for r in rs if r["stalled"]]
    far_orig = [r for r in rs if r["original"]["distance_mi"] > FAR_MI]
    far_final = [r for r in in_person_final if r["final"]["distance_mi"] > FAR_MI]

    by_region = defaultdict(list)
    for r in rs:
        by_region[r["region"]].append(r)
    regions = []
    for name, group in sorted(by_region.items()):
        if len(group) < MIN_CELL:
            continue
        g_far = sum(r["original"]["distance_mi"] > FAR_MI for r in group)
        g_stalled = sum(r["stalled"] for r in group)
        avg_dist = _avg(r["original"]["distance_mi"] for r in group)
        regions.append({
            "region": name,
            "region_type": group[0]["region_type"],
            "lat": round(mean(r["home"]["lat"] for r in group), 3),
            "lon": round(mean(r["home"]["lon"] for r in group), 3),
            "referrals": len(group),
            "avg_distance_to_referred_care_mi": avg_dist,
            "pct_over_30_mi": _pct(g_far, len(group)),
            "avg_wait_days": _avg(r["original"]["wait_days"] for r in group),
            "pct_stalled": _pct(g_stalled, len(group)),
            "public_transit_available": group[0]["public_transit_available"],
            "telehealth_share_pct": _pct(sum(r["final"]["mode"] == "telehealth" for r in group), len(group)),
            "avg_distance_to_nearest_specialist_mi": _avg(r["nearest_specialist_mi"] for r in group),
            # A gap is about supply, not referral habits: even the closest specialist is far away.
            "care_gap": mean(r["nearest_specialist_mi"] for r in group) > FAR_MI * 0.8,
        })
    regions.sort(key=lambda x: (-x["care_gap"], -x["pct_over_30_mi"]))

    barrier_counts = Counter(b for r in rs for b in r["barriers"])
    by_type = defaultdict(list)
    for r in rs:
        by_type[r["region_type"]].append(r)

    stalled_by_stage = Counter(r["state"] for r in stalled)
    months = defaultdict(lambda: {"referrals": 0, "completed": 0, "stalled": 0})
    for r in rs:
        m = months[r["referred_at"][:7]]
        m["referrals"] += 1
        m["completed"] += r["state"] in ("appointment_completed", "followup_required", "followup_completed")
        m["stalled"] += r["stalled"]

    def improvement(key):
        pairs = [(r["original"][key], r["final"][key]) for r in rerouted]
        return {
            "before": _avg(a for a, _ in pairs),
            "after": _avg(b for _, b in pairs),
            "avg_reduction": _avg(a - b for a, b in pairs),
        }

    completed = [r for r in rs if r["state"] in ("appointment_completed", "followup_required", "followup_completed")]
    return {
        "filters": {"region_type": region_type, "specialty": specialty, "region": region},
        "cohort": {"referrals": n, "synthetic": True, "suppressed_below": MIN_CELL},
        "summary": {
            "avg_travel_distance_mi": {
                "original_referral": _avg(r["original"]["distance_mi"] for r in rs),
                "after_hera": _avg(r["final"]["distance_mi"] for r in rs),
            },
            "patients_over_30_mi": {
                "original_referral": len(far_orig),
                "after_hera": len(far_final),
                "pct_original": _pct(len(far_orig), n),
            },
            "wait_time_barriers": {
                "referrals_over_30_days": sum(r["original"]["wait_days"] > LONG_WAIT_DAYS for r in rs),
                "avg_wait_days_original": _avg(r["original"]["wait_days"] for r in rs),
                "avg_wait_days_after_hera": _avg(r["final"]["wait_days"] for r in rs),
            },
            "insurance_barriers": {
                "out_of_network_referrals": sum(not r["original"]["in_network"] for r in rs),
                "resolved_by_rerouting": sum(not r["original"]["in_network"] and r["final"]["in_network"] for r in rerouted),
                "uninsured": sum(r["insurance_plan"] == "Uninsured" for r in rs),
            },
            "stalled_care_pathways": {
                "count": len(stalled),
                "pct": _pct(len(stalled), n),
                "avg_days_stalled": _avg(r["stalled_days"] for r in stalled),
                "by_stage": dict(stalled_by_stage.most_common()),
                "stall_rate_rerouted_pct": _pct(sum(r["stalled"] for r in rerouted), len(rerouted)),
                "stall_rate_not_rerouted_pct": _pct(sum(r["stalled"] for r in rs if not r["rerouted"]), n - len(rerouted)),
            },
            "rerouting_improvement": {
                "rerouted_referrals": len(rerouted),
                "distance_mi": improvement("distance_mi"),
                "wait_days": improvement("wait_days"),
                "estimated_cost_usd": improvement("estimated_cost_usd"),
            },
            "telehealth_utilization": {
                "pct_all": _pct(sum(r["final"]["mode"] == "telehealth" for r in rs), n),
                "by_region_type": {k: _pct(sum(r["final"]["mode"] == "telehealth" for r in v), len(v)) for k, v in sorted(by_type.items())},
            },
            "completion_rate_pct": _pct(len(completed), n),
        },
        "route_access_barriers": [
            {"barrier": b, "label": BARRIER_LABELS.get(b, b), "referrals": c, "pct": _pct(c, n)}
            for b, c in barrier_counts.most_common()
        ],
        "geographic_care_gaps": [x for x in regions if x["care_gap"]],
        "by_region": regions,
        "monthly": [{"month": k, **v} for k, v in sorted(months.items())],
        "notes": [
            "Synthetic cohort for demonstration; figures are illustrative, not real outcomes.",
            f"Regions with fewer than {MIN_CELL} referrals are suppressed.",
            "“After HERA” reflects the provider or telehealth option the patient was rerouted to.",
        ],
    }
