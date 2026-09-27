"""
Transparent route scoring.

Each route gets a 0..1 score per factor (higher = better access / lower risk), and a
0..100 overall score that is the weighted average of the factors that apply to it.
Every factor is returned alongside the metric that produced it, so the UI can show
exactly why a route was recommended. HERA never labels a route "safe": it recommends
routes based on the configured factors and the conditions it was given.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date, timedelta

from .conditions import ConditionsSnapshot
from .geo import haversine_mi, point_polyline_distance_mi
from .routing import RouteCandidate
from .sources import WORLD, load_json

FACTORS = [
    "travel_time", "weather", "road_condition", "construction", "road_type",
    "isolation", "healthcare_proximity", "accessibility", "mobility_fit", "transit_service",
    # pregnancy only
    "ride_smoothness", "restrooms", "food_water", "air_quality", "walk_rest", "obstetric_access",
]
PREGNANCY_FACTORS = {"ride_smoothness", "restrooms", "food_water", "air_quality", "walk_rest", "obstetric_access"}
# Share of each road class that rides rough (worn pavement, patches, rural shoulders); major roads ride smoother.
ROUGHNESS = {"interstate": 0.1, "us_highway": 0.15, "state_highway": 0.25, "arterial": 0.3, "local": 0.45, "rural": 0.5}
SENSITIVE_AQI = 101  # EPA "Unhealthy for Sensitive Groups" starts here; pregnant people are a sensitive group

# How exposed each road class is to winter weather (major roads are treated and plowed first).
WEATHER_EXPOSURE = {"interstate": 0.45, "us_highway": 0.55, "state_highway": 0.75, "arterial": 0.7, "local": 1.0, "rural": 1.0}
ROAD_TYPE_QUALITY = {"interstate": 1.0, "us_highway": 1.0, "state_highway": 0.8, "arterial": 0.85, "local": 0.5, "rural": 0.3}
MAJOR = {"interstate", "us_highway", "state_highway", "arterial"}
NO_CAR = {"no_car", "no_vehicle", "cannot_drive", "no_drivers_license"}
WHEELCHAIR = {"wheelchair_user", "wheelchair", "uses_wheelchair"}
LIMITED_WALKING = {"limited_walking", "limited_mobility", "mobility_aid"}

RECOMMENDATION_NOTE = "Recommended based on current access and route conditions. Not a guarantee of safety; check local conditions before travelling."


def default_weights() -> dict[str, float]:
    path = os.environ.get("HERA_SCORING_WEIGHTS")
    raw = json.load(open(path, encoding="utf-8")) if path else load_json("scoring_weights.json")
    return {k: float(raw[k]) for k in FACTORS if k in raw}


def parse_weight_overrides(spec: str | None) -> dict[str, float]:
    """'travel_time:0.4,weather:0.2' -> {...}; unknown factors or bad numbers raise ValueError."""
    out: dict[str, float] = {}
    if not spec:
        return out
    for part in spec.split(","):
        k, _, v = part.partition(":")
        k = k.strip()
        if k not in FACTORS:
            raise ValueError(f"unknown factor '{k}'; expected one of {', '.join(FACTORS)}")
        w = float(v)
        if w < 0:
            raise ValueError(f"weight for '{k}' must be >= 0")
        out[k] = w
    return out


def weights_for_patient(base: dict[str, float], patient: dict, pregnant: bool = False) -> dict[str, float]:
    """Mobility/accessibility needs, and pregnancy, change which factors matter most for this patient."""
    w = dict(base)
    if pregnant:
        # Fall and delay risks matter more than minutes saved; walking and steps matter more on transit.
        for k, m in {"road_condition": 1.5, "weather": 1.3, "isolation": 1.5, "accessibility": 1.3, "mobility_fit": 1.3, "travel_time": 0.8}.items():
            w[k] = w.get(k, 0) * m
    else:
        for k in PREGNANCY_FACTORS:
            w.pop(k, None)
    needs = set(patient.get("mobility_constraints", [])) | set(patient.get("accessibility_needs", []))
    if needs & (WHEELCHAIR | LIMITED_WALKING):
        w["accessibility"] = w.get("accessibility", 0) * 2
        w["mobility_fit"] = w.get("mobility_fit", 0) * 2
    if needs & NO_CAR:
        w["mobility_fit"] = w.get("mobility_fit", 0) * 3
    return w


@dataclass
class RouteEval:
    candidate: RouteCandidate
    duration_minutes: float
    distance_mi: float
    metrics: dict = field(default_factory=dict)
    factors: dict[str, float] = field(default_factory=dict)
    conditions: list[str] = field(default_factory=list)
    cautions: list[str] = field(default_factory=list)
    closed: bool = False
    score: float = 0.0
    pregnancy_metrics: dict = field(default_factory=dict)


def _clamp(x: float) -> float:
    return max(0.0, min(1.0, x))


def _populated(p, towns) -> bool:
    for t in towns:
        d = haversine_mi(p, (t["lat"], t["lon"]))
        if (t["population"] >= 50000 and d <= 12) or (t["population"] >= 5000 and d <= 6):
            return True
    return False


def _event_hits(ev, point, seg) -> bool:
    if haversine_mi(point, (ev.lat, ev.lon)) > ev.radius_mi:
        return False
    return ev.road is None or ev.road.lower() in seg.road.lower()


def evaluate(c: RouteCandidate, patient: dict, provider: dict, cond: ConditionsSnapshot, pregnant: bool = False) -> RouteEval:
    samples = c.samples(0.5)
    length = c.distance_mi or 1e-9
    needs = set(patient.get("mobility_constraints", [])) | set(patient.get("accessibility_needs", []))
    is_transit = c.transit is not None

    # --- weather exposure and slowdown -------------------------------------------------
    exposure, slowdown_min, kinds = 0.0, 0.0, {}
    base_min = c.base_minutes()
    for p, seg, per in samples:
        sev = max((z.severity for z in cond.weather if haversine_mi(p, (z.lat, z.lon)) <= z.radius_mi), default=0.0)
        if sev:
            ex = sev * WEATHER_EXPOSURE[seg.road_class]
            exposure += ex * per
            if not is_transit:
                slowdown_min += per / (length or 1) * base_min * 0.6 * ex
            for z in cond.weather:
                if haversine_mi(p, (z.lat, z.lon)) <= z.radius_mi:
                    kinds[z.kind] = kinds.get(z.kind, 0) + per
    weather_exposure = exposure / length
    exposed_share = sum(kinds.values()) / length if kinds else 0.0
    if is_transit:
        # Transit riders are exposed while walking and waiting; use conditions at the origin.
        o = c.waypoints[0]
        sev0 = max((z.severity for z in cond.weather if haversine_mi(o, (z.lat, z.lon)) <= z.radius_mi), default=0.0)
        wait = c.transit.get("walk_minutes", 0) + c.transit.get("headway_minutes", 0) / 2
        weather_exposure = sev0 * min(1.0, wait / 30) * (0.6 if c.transit.get("sheltered_stops") else 1.0)

    # --- road events --------------------------------------------------------------------
    hit: dict[str, object] = {}
    for p, seg, _ in samples:
        for ev in cond.road_events:
            if ev.event_id not in hit and _event_hits(ev, p, seg):
                hit[ev.event_id] = ev
    events = list(hit.values())
    construction = [e for e in events if e.kind == "construction"]
    closures = [e for e in events if e.kind == "closure"]
    hazards = [e for e in events if e.kind not in ("construction", "closure")]
    delay = sum(e.delay_minutes for e in events)

    # --- geography: isolation, healthcare, road type ------------------------------------
    longest_gap = gap = 0.0
    for p, _, per in samples:
        if _populated(p, WORLD.towns):
            gap = 0.0
        else:
            gap += per
            longest_gap = max(longest_gap, gap)
    care = [f for f in WORLD.facilities if f["kind"] in ("hospital_er", "urgent_care", "clinic")]
    er = [f for f in care if f["kind"] == "hospital_er"]
    covered = sum(per for p, _, per in samples if any(haversine_mi(p, (f["lat"], f["lon"])) <= 10 for f in er))
    coverage = covered / length if samples else 1.0
    pts = [p for p, _, _ in samples] or c.waypoints
    passes = [f for f in care if point_polyline_distance_mi((f["lat"], f["lon"]), [c.waypoints[0], *pts]) <= 1.0]
    major_share = sum(s.length_mi for s in c.segments if s.road_class in MAJOR) / length
    road_quality = sum(s.length_mi * ROAD_TYPE_QUALITY[s.road_class] for s in c.segments) / length

    # --- destination accessibility & patient mobility -----------------------------------
    feats = set(provider.get("accessibility_features", []))
    access = 0.25 + 0.5 * ("wheelchair_accessible" in feats) + 0.25 * ("ground_floor_entrance" in feats)
    if needs & WHEELCHAIR and "wheelchair_accessible" not in feats:
        access = 0.0
    mobility = 1.0
    if is_transit:
        walk = c.transit.get("walk_minutes", 0)
        mobility = 1 - min(0.5, walk / 40)
        if not c.transit.get("step_free"):
            access *= 0.6
            if needs & WHEELCHAIR:
                mobility = 0.1
        if needs & LIMITED_WALKING and walk > 8:
            mobility = min(mobility, 0.4)
    elif needs & NO_CAR:
        mobility = 0.15

    duration = base_min + slowdown_min + delay
    ev = RouteEval(c, duration_minutes=duration, distance_mi=length)
    ev.closed = bool(closures)
    ev.factors = {
        "weather": _clamp(1 - weather_exposure * 1.25),
        "road_condition": _clamp(1 - sum(e.severity for e in hazards) - (1.0 if closures else 0.0)),
        "construction": _clamp(1 - sum(e.severity for e in construction)),
        "road_type": _clamp(road_quality),
        "isolation": _clamp(1 - longest_gap / 25),
        "healthcare_proximity": _clamp(0.6 * coverage + 0.4 * min(1.0, len(passes) / 2)),
        "accessibility": _clamp(access),
        "mobility_fit": _clamp(mobility),
    }
    if pregnant:
        _pregnancy_factors(ev, c, samples, length, is_transit, events, cond.baseline_aqi)
    if is_transit:
        t = c.transit
        ev.factors["transit_service"] = _clamp(1 - 0.15 * t.get("transfers", 0) - min(0.4, t.get("headway_minutes", 0) / 150) + (0.1 if t.get("sheltered_stops") else 0))
    ev.metrics = {
        "weather_exposure": round(weather_exposure, 3),
        "weather_exposed_share": round(exposed_share, 3),
        "weather_kinds": sorted(kinds, key=kinds.get, reverse=True),
        "weather_delay_minutes": round(slowdown_min, 1),
        "event_delay_minutes": round(delay, 1),
        "construction": [e.label for e in construction],
        "closures": [e.label for e in closures],
        "road_hazards": [e.label for e in hazards],
        "major_road_share": round(major_share, 2),
        "roads": [s.road for s in c.segments],
        "longest_isolated_stretch_mi": round(longest_gap, 1),
        "er_coverage_share": round(coverage, 2),
        "healthcare_facilities_passed": [f["name"] for f in passes],
        "destination_accessibility": sorted(feats),
    }
    if is_transit:
        ev.metrics["transit"] = dict(c.transit)
    ev.metrics.update(ev.pregnancy_metrics)
    ev.conditions, ev.cautions = _describe(ev)
    return ev


def _pregnancy_factors(ev: RouteEval, c: RouteCandidate, samples, length: float, is_transit: bool, events, baseline_aqi: int) -> None:
    """What matters most on a trip while pregnant: a smooth ride, restrooms, food and water, clean air
    (no construction dust), benches on walks, and not being far from labor & delivery care."""
    pts = [c.waypoints[0], *[p for p, _, _ in samples]]
    minutes_per_mile = ev.duration_minutes / (length or 1)

    # Ride smoothness: road-class roughness plus reported potholes / rough pavement.
    potholes = [e for e in events if e.kind == "pothole"]
    rough = sum(s.length_mi * ROUGHNESS[s.road_class] for s in c.segments) / (length or 1)
    ev.factors["ride_smoothness"] = _clamp(1 - rough - 0.6 * sum(e.severity for e in potholes))

    # Restrooms, food and water: amenities near the route, plus towns (>= 2,000 people) and clinics along it.
    near = lambda lat, lon, r: point_polyline_distance_mi((lat, lon), pts) <= r
    amen = [a for a in WORLD.amenities if near(a["lat"], a["lon"], 0.5 if length < 25 else 1.5)]
    towns = [t for t in WORLD.towns if t["population"] >= 2000 and near(t["lat"], t["lon"], 2.0)]
    clinics = [f for f in WORLD.facilities if "restrooms" in f.get("services", []) and near(f["lat"], f["lon"], 0.5 if length < 25 else 1.0)]
    restroom_spots = [(a["lat"], a["lon"]) for a in amen if "restroom" in a["kinds"]] + [(t["lat"], t["lon"]) for t in towns] + [(f["lat"], f["lon"]) for f in clinics]
    food_spots = [(a["lat"], a["lon"]) for a in amen if {"food", "water"} & set(a["kinds"])] + [(t["lat"], t["lon"]) for t in towns]

    def longest_gap_min(spots, radius):
        gap = longest = 0.0
        for p, _, per in samples:
            if any(haversine_mi(p, s) <= radius for s in spots):
                gap = 0.0
            else:
                gap += per
                longest = max(longest, gap)
        return longest * minutes_per_mile

    radius = 2.0 if length >= 25 else 0.6
    restroom_gap = longest_gap_min(restroom_spots, radius)
    food_gap = longest_gap_min(food_spots, radius)
    if ev.duration_minutes < 45:  # short trip: what matters is having somewhere on the way
        ev.factors["restrooms"] = 1.0 if restroom_spots else 0.4
        ev.factors["food_water"] = 1.0 if food_spots else 0.5
    else:
        ev.factors["restrooms"] = _clamp(1 - max(0.0, restroom_gap - 45) / 75)
        ev.factors["food_water"] = _clamp(1 - max(0.0, food_gap - 60) / 90)

    # Air quality: construction zones raise dust and exhaust along the route.
    dusty = [e for e in events if e.kind == "construction"]
    worst_aqi = max([e.aqi or 90 for e in dusty], default=baseline_aqi)
    ev.factors["air_quality"] = _clamp(1 - max(0, worst_aqi - 50) / 100) if dusty else _clamp(1 - max(0, baseline_aqi - 50) / 100)

    # Benches on the walking part of transit trips.
    benches = walk = 0
    if is_transit:
        t = c.transit or {}
        benches, walk = t.get("benches", 0), t.get("walk_minutes", 0)
        needed = max(1, round(walk / 3)) if walk > 3 else 0
        ev.factors["walk_rest"] = 1.0 if needed == 0 else _clamp(benches / needed)
        if walk > 8:
            ev.factors["mobility_fit"] = min(ev.factors["mobility_fit"], 0.5)
        if not t.get("step_free"):
            ev.factors["mobility_fit"] = min(ev.factors["mobility_fit"], 0.3)

    # Labor & delivery care along the way (secondary).
    ld = [f for f in WORLD.facilities if "labor_delivery" in f.get("services", [])]
    covered = sum(per for p, _, per in samples if any(haversine_mi(p, (f["lat"], f["lon"])) <= 15 for f in ld))
    ev.factors["obstetric_access"] = _clamp(covered / length if samples else 1.0)
    farthest = max((min(haversine_mi(p, (f["lat"], f["lon"])) for f in ld) for p, _, _ in samples), default=0.0)

    ev.pregnancy_metrics = {
        "pregnancy": True,
        "major_road_share_smooth": round(1 - rough, 2),
        "potholes": [e.label for e in potholes],
        "restroom_count": len(restroom_spots),
        "restroom_gap_minutes": round(restroom_gap),
        "food_water_count": len(food_spots),
        "food_water_gap_minutes": round(food_gap),
        "construction_zones": [e.label for e in dusty],
        "worst_aqi": worst_aqi,
        "baseline_aqi": baseline_aqi,
        "walk_minutes": walk,
        "benches": benches,
        "farthest_from_labor_delivery_mi": round(farthest, 1),
        "amenities_on_route": [a["name"] for a in amen],
    }


def _aqi_band(aqi: int) -> str:
    return "good" if aqi <= 50 else "moderate" if aqi <= 100 else "unhealthy for sensitive groups, including pregnancy" if aqi <= 150 else "unhealthy"


def pregnancy_check(ev: RouteEval) -> list[dict]:
    """Plain-language checks of what matters when traveling while pregnant, each met or not."""
    m = ev.metrics
    long_trip = ev.duration_minutes >= 45
    checks = []
    if m["potholes"]:
        checks.append({"label": f"Bumpy: {m['potholes'][0]}", "ok": False})
    else:
        checks.append({"label": f"Smooth ride: {round(m['major_road_share_smooth'] * 100)}% smooth pavement, no potholes reported", "ok": m["major_road_share_smooth"] >= 0.7})
    if long_trip:
        checks.append({"label": f"Public restroom at least every {max(m['restroom_gap_minutes'], 10)} min", "ok": m["restroom_gap_minutes"] <= 45})
        checks.append({"label": f"Food & water at least every {max(m['food_water_gap_minutes'], 10)} min", "ok": m["food_water_gap_minutes"] <= 60})
    else:
        n = m["restroom_count"]
        checks.append({"label": f"{n} public restroom{'s' if n != 1 else ''} along the way" if n else "No public restroom along the way", "ok": n > 0})
        n = m["food_water_count"]
        checks.append({"label": f"{n} place{'s' if n != 1 else ''} to eat or get water" if n else "Nowhere to eat or get water on the way", "ok": n > 0})
    if m["construction_zones"]:
        checks.append({"label": f"Construction dust near {m['construction_zones'][0]}: air quality ~{m['worst_aqi']} ({_aqi_band(m['worst_aqi'])})", "ok": False})
    else:
        checks.append({"label": f"No construction zones: air quality {m['baseline_aqi']} ({_aqi_band(m['baseline_aqi'])})", "ok": m["baseline_aqi"] < SENSITIVE_AQI})
    if ev.candidate.transit:
        walk, b = m["walk_minutes"], m["benches"]
        checks.append({"label": f"{b} bench{'es' if b != 1 else ''} to rest on during the {walk}-min walk", "ok": walk <= 3 or b >= max(1, round(walk / 3))})
    far = m["farthest_from_labor_delivery_mi"]
    checks.append({"label": f"Never more than {far:.0f} mi from labor & delivery care", "ok": far <= 15})
    return checks


def _weather_risk(ev: RouteEval) -> str:
    x = ev.metrics["weather_exposure"]
    return "high" if x >= 0.45 else "moderate" if x >= 0.15 else "low"


def _describe(ev: RouteEval) -> tuple[list[str], list[str]]:
    m, conds, cautions = ev.metrics, [], []
    kinds = m["weather_kinds"]
    if kinds:
        names = {"snow": "Snow expected", "sleet": "Sleet expected", "freezing_rain": "Freezing rain", "ice": "Ice advisory", "rain": "Rain"}
        conds += [names.get(k, k.replace("_", " ").capitalize()) for k in kinds[:2]]
    for label in m["closures"]:
        conds.append(f"Closure: {label}")
        cautions.append(f"Reported closure: {label}. This route may not be passable.")
    for label in m["construction"]:
        conds.append(f"Construction: {label}")
    for label in m["road_hazards"]:
        conds.append(label)
    if m["major_road_share"] >= 0.8 and not ev.candidate.transit:
        conds.append("Major roads")
    n = len(m["healthcare_facilities_passed"])
    if n:
        conds.append(f"Passes {n} medical {'facility' if n == 1 else 'facilities'}")
    if m["longest_isolated_stretch_mi"] >= 8:
        conds.append(f"No services for {m['longest_isolated_stretch_mi']:.0f} mi")
        cautions.append(f"Longest stretch away from populated areas: {m['longest_isolated_stretch_mi']:.0f} mi.")
    if ev.candidate.transit:
        t = ev.candidate.transit
        conds.append(f"{t['transfers']} transfer{'s' if t['transfers'] != 1 else ''}" if t.get("transfers") else "No transfers")
        conds.append("Step-free" if t.get("step_free") else "Not step-free")
        conds.append(f"{t.get('walk_minutes', 0)} min walk")
    if m.get("pregnancy"):
        n = m["restroom_count"]
        if n:
            conds.append(f"{n} restroom{'s' if n != 1 else ''} on the way")
        if m["construction_zones"]:
            conds.append(f"Construction dust (AQI ~{m['worst_aqi']})")
            if m["worst_aqi"] >= SENSITIVE_AQI:
                cautions.append("Construction dust can push air quality into the range that's unhealthy for sensitive groups, including pregnancy.")
        if ev.duration_minutes >= 45 and m["restroom_gap_minutes"] > 45:
            cautions.append(f"No public restroom for about {m['restroom_gap_minutes']} min: plan a stop before you go.")
        if ev.duration_minutes >= 90 and not ev.candidate.transit:
            cautions.append("Plan a stop to walk, stretch, drink water and eat at least every 1–2 hours.")
    if _weather_risk(ev) == "high":
        cautions.append("High winter-weather exposure on this route.")
    if ev.factors["mobility_fit"] < 0.5:
        cautions.append("May not fit the patient's mobility or transportation constraints.")
    if ev.factors["accessibility"] == 0:
        cautions.append("Destination is not confirmed wheelchair accessible.")
    return conds, cautions


def _reason_phrases(best: RouteEval, other: RouteEval) -> list[str]:
    b, o, bm, om = best.factors, other.factors, best.metrics, other.metrics
    phrases = []
    if b["road_type"] - o["road_type"] >= 0.1:
        phrases.append(f"uses major roads ({', '.join(dict.fromkeys(r for r, s in zip(bm['roads'], best.candidate.segments) if s.road_class in MAJOR))})")
    if om["construction"] and not bm["construction"]:
        phrases.append(f"avoids reported construction ({'; '.join(om['construction'])})")
    if om["closures"] and not bm["closures"]:
        phrases.append(f"avoids a reported closure ({'; '.join(om['closures'])})")
    if om["road_hazards"] and len(bm["road_hazards"]) < len(om["road_hazards"]):
        phrases.append(f"avoids reported road hazards ({'; '.join(h for h in om['road_hazards'] if h not in bm['road_hazards']).lower()})")
    if b["weather"] - o["weather"] >= 0.08:
        phrases.append(f"has lower winter-weather exposure ({_weather_risk(best)} vs {_weather_risk(other)})")
    if b["isolation"] - o["isolation"] >= 0.1:
        phrases.append(f"stays closer to populated areas (longest isolated stretch {bm['longest_isolated_stretch_mi']:.0f} mi vs {om['longest_isolated_stretch_mi']:.0f} mi)")
    if b["healthcare_proximity"] - o["healthcare_proximity"] >= 0.08:
        n = len(bm["healthcare_facilities_passed"])
        phrases.append(f"remains closer to emergency medical resources (passes {n} healthcare {'facility' if n == 1 else 'facilities'})")
    if b.get("ride_smoothness", 0) - o.get("ride_smoothness", 0) >= 0.1:
        phrases.append("gives a smoother ride with fewer potholes")
    if b.get("air_quality", 0) - o.get("air_quality", 0) >= 0.1:
        phrases.append("avoids construction dust")
    if b.get("restrooms", 0) - o.get("restrooms", 0) >= 0.15:
        phrases.append("has more public restrooms along the way")
    if b.get("food_water", 0) - o.get("food_water", 0) >= 0.15:
        phrases.append("has more places to eat and get water")
    if b.get("obstetric_access", 0) - o.get("obstetric_access", 0) >= 0.1:
        phrases.append("stays closer to hospitals with labor & delivery care")
    if b["mobility_fit"] - o["mobility_fit"] >= 0.2:
        phrases.append("better fits the patient's mobility and transportation needs")
    return phrases


def _join(phrases: list[str]) -> str:
    return phrases[0] if len(phrases) == 1 else ", ".join(phrases[:-1]) + ", and " + phrases[-1]


def rank(
    candidates: list[RouteCandidate],
    patient: dict,
    provider: dict,
    cond: ConditionsSnapshot,
    weights: dict[str, float],
    appointment_date: date | None = None,
    pregnant: bool = False,
) -> dict:
    evals = [evaluate(c, patient, provider, cond, pregnant) for c in candidates]
    w = weights_for_patient(weights, patient, pregnant)
    if evals:
        fastest_min = min(e.duration_minutes for e in evals if not e.closed) if any(not e.closed for e in evals) else min(e.duration_minutes for e in evals)
        for e in evals:
            e.factors["travel_time"] = _clamp(fastest_min / e.duration_minutes) if e.duration_minutes else 1.0
            used = {k: w.get(k, 0) for k in e.factors if w.get(k, 0) > 0}
            total = sum(used.values()) or 1.0
            e.score = 100 * sum(e.factors[k] * wk for k, wk in used.items()) / total
            if e.closed:
                e.score *= 0.3
    fastest = min((e for e in evals if not e.candidate.transit), key=lambda e: e.duration_minutes, default=None)
    best = max(evals, key=lambda e: e.score, default=None)

    options = []
    for e in sorted(evals, key=lambda e: -e.score):
        is_best = e is best
        c = e.candidate
        if is_best:
            label = "Recommended for pregnancy" if pregnant else "HERA recommended"
        elif c.transit:
            label = "Public transit"
        elif e is fastest:
            label = "Fastest route"
        else:
            label = "Alternative route"
        mode = "transit" if c.transit else ("fastest" if e is fastest else "safer")
        reasons = []
        if is_best:
            others = [o for o in evals if o is not e and not o.candidate.transit] if not c.transit else [o for o in evals if o is not e]
            ref = fastest if fastest is not None and fastest is not e else (others[0] if others else None)
            phrases = _reason_phrases(e, ref) if ref else []
            if e is fastest:
                reasons.append("Fastest option, and it also scores best on the configured access and risk factors.")
            elif phrases:
                reasons.append(f"Recommended{' for travel while pregnant' if pregnant else ''} because it {_join(phrases)}.")
            else:
                reasons.append("Highest overall access score across the configured factors.")
            if ref is not None and ref is fastest and e is not fastest:
                extra = round(e.duration_minutes) - round(fastest.duration_minutes)
                if extra > 0:
                    reasons.append(f"Adds about {extra} min compared with the fastest route.")
        options.append({
            "route_id": c.route_id,
            "mode": mode,
            "label": label,
            "name": c.name,
            "duration_minutes": round(e.duration_minutes),
            "distance_mi": round(e.distance_mi, 1),
            "summary": f"{c.name} · {e.distance_mi:.1f} mi" + (f" · {c.transit['transfers']} transfer{'s' if c.transit['transfers'] != 1 else ''}" if c.transit else ""),
            "conditions": e.conditions,
            "recommended": is_best,
            "score": round(e.score, 1),
            "factor_scores": {f"{k}_score": round(v, 2) for k, v in e.factors.items()},
            "weather_risk": _weather_risk(e),
            "construction": bool(e.metrics["construction"]),
            "reasons": reasons,
            "cautions": e.cautions,
            "metrics": e.metrics,
            "geometry": [[round(p[0], 5), round(p[1], 5)] for p in c.waypoints],
            "generated_geometry": c.generated,
            "pregnancy_check": pregnancy_check(e) if pregnant else None,
        })

    if provider.get("telehealth_available"):
        avail = (appointment_date or date.today()) + timedelta(days=min(2, provider.get("wait_days", 2)))
        low_access = bool(evals) and (best.score < 55 or all(e.closed for e in evals))
        options.append({
            "route_id": f"tele-{provider['provider_id']}",
            "mode": "telehealth",
            "label": "Telehealth alternative",
            "name": "Video visit",
            "duration_minutes": None,
            "distance_mi": 0,
            "summary": f"Video visit with {provider['name']}'s clinic",
            "conditions": [f"Available {avail.strftime('%b')} {avail.day}", "No travel needed"],
            "recommended": False,
            "suggested": low_access,
            "score": None,
            "factor_scores": {},
            "weather_risk": "none",
            "construction": False,
            "reasons": ["No travel: consider for intake or follow-up when in-person travel is difficult."] + (
                ["Suggested because every in-person route has significant access barriers right now."] if low_access else []),
            "cautions": ["Some exams and procedures still require an in-person visit."],
            "metrics": {},
            "geometry": [],
            "generated_geometry": False,
        })
    return {"options": options, "weights": w}
