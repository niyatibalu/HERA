"""
Route candidates between a patient and a provider.

Demo destinations use hand-authored corridors (data/corridors.json). Any other
patient/provider pair gets generated candidates, so selecting an unexpected provider
still produces a usable map instead of an error.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .geo import LatLon, densify, haversine_mi
from .sources import WORLD, load_json

# Typical free-flow speeds (mph) and how much of each class's length feels like the road itself.
SPEED_MPH = {"interstate": 65, "us_highway": 52, "state_highway": 48, "arterial": 27, "local": 20, "rural": 45}
URBAN_CLASSES = {"arterial", "local"}
WINDING = 1.15  # waypoint polylines are straighter than real roads
URBAN_OVERHEAD_MIN_PER_MI = 1.2  # signals, turns


@dataclass
class Segment:
    road_class: str
    road: str
    points: list[LatLon]

    @property
    def length_mi(self) -> float:
        return sum(haversine_mi(self.points[i], self.points[i + 1]) for i in range(len(self.points) - 1)) * WINDING


@dataclass
class RouteCandidate:
    route_id: str
    mode: str  # fastest | safer | transit (telehealth is added by the scorer)
    name: str
    waypoints: list[LatLon]
    segments: list[Segment]
    transit: dict | None = None
    generated: bool = False

    @property
    def distance_mi(self) -> float:
        return sum(s.length_mi for s in self.segments)

    def base_minutes(self) -> float:
        if self.transit:
            return float(self.transit["duration_minutes"])
        total = 0.0
        for s in self.segments:
            total += s.length_mi / SPEED_MPH[s.road_class] * 60
            if s.road_class in URBAN_CLASSES:
                total += s.length_mi * URBAN_OVERHEAD_MIN_PER_MI
        return total

    def samples(self, step_mi: float = 0.5) -> list[tuple[LatLon, Segment, float]]:
        """Points along the route with the segment they fall on and the length each represents."""
        out = []
        for s in self.segments:
            pts = densify(s.points, step_mi)
            if len(pts) < 2:
                continue
            per = s.length_mi / (len(pts) - 1)
            out += [(p, s, per) for p in pts[1:]]
        return out


def _from_template(t: dict) -> RouteCandidate:
    wps = [tuple(p) for p in t["waypoints"]]
    segs, start = [], 0
    for s in t["segments"]:
        segs.append(Segment(s["road_class"], s["road"], wps[start : s["until"] + 1]))
        start = s["until"]
    return RouteCandidate(t["route_id"], t["mode"], t["name"], wps, segs, t.get("transit"))


def _offset_point(a: LatLon, b: LatLon, frac: float, bend: float) -> LatLon:
    """Point at `frac` along a→b, pushed perpendicular by `bend` × distance."""
    lat = a[0] + (b[0] - a[0]) * frac
    lon = a[1] + (b[1] - a[1]) * frac
    return (lat + -(b[1] - a[1]) * bend, lon + (b[0] - a[0]) * bend)


def generated_candidates(origin: LatLon, dest: LatLon, provider_id: str) -> list[RouteCandidate]:
    d = haversine_mi(origin, dest)
    rid = f"gen-{provider_id}"
    if d < 0.15:
        return []  # same building/block: nothing to route; telehealth/in-person only
    if d < 12:
        fast = RouteCandidate(
            f"{rid}-direct", "fastest", "Most direct streets",
            [origin, _offset_point(origin, dest, 0.5, 0.05), dest],
            [Segment("local", "Local streets", [origin, _offset_point(origin, dest, 0.5, 0.05), dest])],
            generated=True,
        )
        mid = _offset_point(origin, dest, 0.5, -0.18)
        major = RouteCandidate(
            f"{rid}-arterial", "safer", "Via main arterials", [origin, mid, dest],
            [Segment("arterial", "Main arterials", [origin, mid, dest])], generated=True,
        )
        out = [fast, major]
        if _near_big_town(origin) and _near_big_town(dest):
            out.append(RouteCandidate(
                f"{rid}-transit", "transit", "Local bus", [origin, mid, dest],
                [Segment("arterial", "Bus route", [origin, mid, dest])],
                transit={"duration_minutes": round(fast.base_minutes() * 2.4 + 8), "transfers": 1, "walk_minutes": 8,
                         "step_free": True, "headway_minutes": 20, "sheltered_stops": False},
                generated=True,
            ))
        return out
    # Longer trips: a rural shortcut vs. a highway route that bends through the biggest town between.
    edge = min(0.3, 3 / d)  # only the first/last few miles are town streets
    p1, p2 = _offset_point(origin, dest, edge, 0.06), _offset_point(origin, dest, 1 - edge, 0.06)
    rural = RouteCandidate(
        f"{rid}-rural", "fastest", "Most direct (rural highways)", [origin, p1, p2, dest],
        [Segment("arterial", "Local streets", [origin, p1]), Segment("rural", "Rural 2-lane highway", [p1, p2]),
         Segment("arterial", "Local streets", [p2, dest])],
        generated=True,
    )
    hub = _best_town_between(origin, dest)
    via = (hub["lat"], hub["lon"]) if hub else _offset_point(origin, dest, 0.5, -0.12)
    highway = RouteCandidate(
        f"{rid}-highway", "safer", f"Via highways{' through ' + hub['name'] if hub else ''}", [origin, via, dest],
        [Segment("interstate", "Interstate / US highway", [origin, via]), Segment("interstate", "Interstate / US highway", [via, dest])],
        generated=True,
    )
    return [rural, highway]


def _near_big_town(p: LatLon, within_mi: float = 10) -> bool:
    return any(t["population"] >= 50000 and haversine_mi(p, (t["lat"], t["lon"])) <= within_mi for t in WORLD.towns)


def _best_town_between(a: LatLon, b: LatLon) -> dict | None:
    d = haversine_mi(a, b)
    best = None
    for t in WORLD.towns:
        p = (t["lat"], t["lon"])
        detour = haversine_mi(a, p) + haversine_mi(p, b) - d
        if 0.5 < haversine_mi(a, p) and haversine_mi(p, b) > 0.5 and detour < d * 0.25:
            if best is None or t["population"] > best["population"]:
                best = t
    return best


_CORRIDORS = load_json("corridors.json")


def route_candidates(patient_id: str, origin: LatLon, provider: dict) -> list[RouteCandidate]:
    templates = _CORRIDORS.get(patient_id, {}).get(provider["provider_id"])
    if templates:
        return [_from_template(t) for t in templates]
    dest = (provider["location"]["lat"], provider["location"]["lon"])
    return generated_candidates(origin, dest, provider["provider_id"])
