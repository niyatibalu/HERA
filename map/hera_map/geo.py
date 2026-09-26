"""Small, dependency-free geometry helpers (miles, lat/lon degrees)."""

from __future__ import annotations

import math

EARTH_RADIUS_MI = 3958.8

LatLon = tuple[float, float]


def haversine_mi(a: LatLon, b: LatLon) -> float:
    lat1, lon1 = map(math.radians, a)
    lat2, lon2 = map(math.radians, b)
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_MI * math.asin(math.sqrt(h))


def polyline_length_mi(points: list[LatLon]) -> float:
    return sum(haversine_mi(points[i], points[i + 1]) for i in range(len(points) - 1))


def _to_xy(p: LatLon, ref_lat: float) -> tuple[float, float]:
    # Local equirectangular projection in miles; accurate enough at route scale.
    return (p[1] * 69.172 * math.cos(math.radians(ref_lat)), p[0] * 69.0)


def point_segment_distance_mi(p: LatLon, a: LatLon, b: LatLon) -> float:
    ref = (a[0] + b[0]) / 2
    px, py = _to_xy(p, ref)
    ax, ay = _to_xy(a, ref)
    bx, by = _to_xy(b, ref)
    dx, dy = bx - ax, by - ay
    seg2 = dx * dx + dy * dy
    t = 0.0 if seg2 == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / seg2))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def point_polyline_distance_mi(p: LatLon, points: list[LatLon]) -> float:
    if len(points) == 1:
        return haversine_mi(p, points[0])
    return min(point_segment_distance_mi(p, points[i], points[i + 1]) for i in range(len(points) - 1))


def densify(points: list[LatLon], step_mi: float = 1.0) -> list[LatLon]:
    """Insert intermediate points so no gap exceeds step_mi (used for sampling along a route)."""
    out: list[LatLon] = [points[0]]
    for i in range(len(points) - 1):
        a, b = points[i], points[i + 1]
        n = max(1, math.ceil(haversine_mi(a, b) / step_mi))
        for k in range(1, n + 1):
            t = k / n
            out.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return out
