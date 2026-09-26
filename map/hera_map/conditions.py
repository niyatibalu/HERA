"""
Travel conditions: weather and road events that routes are scored against.

A ConditionsSnapshot is the only thing the scorer sees, so any source (the deterministic
demo scenario, a live weather API, a DOT/511 road feed) just has to produce one.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class WeatherZone:
    zone_id: str
    kind: str  # snow | sleet | freezing_rain | ice | rain | clear
    severity: float  # 0..1
    lat: float
    lon: float
    radius_mi: float
    label: str
    window: str = ""


@dataclass
class RoadEvent:
    event_id: str
    kind: str  # construction | closure | unplowed | poor_pavement | flooding
    lat: float
    lon: float
    radius_mi: float
    severity: float  # 0..1
    label: str
    road: str | None = None  # substring of a segment road name; None = any road in the radius
    delay_minutes: float = 0.0


@dataclass
class ConditionsSnapshot:
    as_of: str
    weather: list[WeatherZone] = field(default_factory=list)
    road_events: list[RoadEvent] = field(default_factory=list)
    source: dict[str, str] = field(default_factory=lambda: {"weather": "none", "roads": "none"})
    scenario: str = "clear"
    summary: str = "No weather or road events reported."

    def to_dict(self) -> dict:
        return {
            "as_of": self.as_of,
            "scenario": self.scenario,
            "summary": self.summary,
            "source": self.source,
            "weather": [vars(z) for z in self.weather],
            "road_events": [vars(e) for e in self.road_events],
        }


def clear_conditions(as_of: str = "") -> ConditionsSnapshot:
    return ConditionsSnapshot(as_of=as_of)


# ---------------------------------------------------------------------------------------
# Adapters. Each returns a ConditionsSnapshot or raises; get_conditions() handles fallback.
# ---------------------------------------------------------------------------------------

import json  # noqa: E402
import logging  # noqa: E402
import urllib.parse  # noqa: E402
import urllib.request  # noqa: E402

from . import config  # noqa: E402
from .geo import haversine_mi  # noqa: E402

log = logging.getLogger("hera_map")


class UnknownScenario(KeyError):
    pass


def scenario_conditions(name: str, as_of: str) -> ConditionsSnapshot:
    """Deterministic demo conditions from data/conditions_scenarios.json."""
    from .sources import load_json

    scenarios = load_json("conditions_scenarios.json")
    if name not in scenarios or name.startswith("_"):
        raise UnknownScenario(name)
    s = scenarios[name]
    return ConditionsSnapshot(
        as_of=as_of,
        weather=[WeatherZone(**z) for z in s["weather"]],
        road_events=[RoadEvent(**e) for e in s["road_events"]],
        source={"weather": f"demo:{name}", "roads": f"demo:{name}"},
        scenario=name,
        summary=s["summary"],
    )


def scenario_names() -> list[str]:
    from .sources import load_json

    return [k for k in load_json("conditions_scenarios.json") if not k.startswith("_")]


# WMO weather codes (used by Open-Meteo) -> our weather kinds
_WMO = {
    **{c: "snow" for c in (71, 73, 75, 77, 85, 86)},
    **{c: "freezing_rain" for c in (56, 57, 66, 67)},
    **{c: "rain" for c in (61, 63, 65, 80, 81, 82)},
}


def _http_json(url: str):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "HERA-hackathon/0.1"})
    with urllib.request.urlopen(req, timeout=config.LIVE_TIMEOUT_S) as res:
        return json.loads(res.read().decode("utf-8"))


def open_meteo_weather(points: list[tuple[float, float]], day: str) -> list[WeatherZone]:
    """Live daily forecast at a few points along the trip (no API key needed).

    Each point becomes a zone covering its share of the trip. Raises on any network or
    format problem so the caller can fall back to the demo scenario.
    """
    zones = []
    radius = max(2.0, haversine_mi(points[0], points[-1]) / max(1, len(points) - 1) * 0.75)
    for i, (lat, lon) in enumerate(points):
        q = urllib.parse.urlencode({
            "latitude": lat, "longitude": lon, "timezone": "auto", "start_date": day, "end_date": day,
            "daily": "weather_code,snowfall_sum,precipitation_sum,temperature_2m_min",
        })
        d = _http_json(f"https://api.open-meteo.com/v1/forecast?{q}")["daily"]
        code = int(d["weather_code"][0])
        kind = _WMO.get(code)
        if kind is None:
            continue
        snow_cm = float(d.get("snowfall_sum", [0])[0] or 0)
        precip = float(d.get("precipitation_sum", [0])[0] or 0)
        tmin = d.get("temperature_2m_min", [None])[0]
        if kind == "snow":
            sev = min(1.0, 0.25 + snow_cm / 10)
        elif kind == "freezing_rain":
            sev = min(1.0, 0.6 + precip / 20)
        else:
            sev = 0.35 if tmin is not None and tmin <= 1 else 0.1  # rain near freezing can ice over
        zones.append(WeatherZone(f"live-{i}", kind, round(sev, 2), lat, lon, radius,
                                 f"{kind.replace('_', ' ').capitalize()} forecast", day))
    return zones


def geojson_road_events(url: str) -> list[RoadEvent]:
    """Road events from any GeoJSON FeatureCollection of Points (e.g. a 511/DOT feed proxied to this shape).

    Expected properties: kind, severity (0-1), label, optional road, radius_mi, delay_minutes.
    """
    fc = _http_json(url)
    out = []
    for i, f in enumerate(fc.get("features", [])):
        if (f.get("geometry") or {}).get("type") != "Point":
            continue
        lon, lat = f["geometry"]["coordinates"][:2]
        p = f.get("properties") or {}
        out.append(RoadEvent(
            event_id=str(p.get("id", f"feed-{i}")), kind=str(p.get("kind", "construction")),
            lat=float(lat), lon=float(lon), radius_mi=float(p.get("radius_mi", 0.5)),
            severity=max(0.0, min(1.0, float(p.get("severity", 0.5)))), label=str(p.get("label", "Reported road event")),
            road=p.get("road"), delay_minutes=float(p.get("delay_minutes", 0)),
        ))
    return out


def get_conditions(as_of: str, points: list[tuple[float, float]], scenario: str | None = None) -> ConditionsSnapshot:
    """Demo scenario by default; live sources replace their part only when enabled and healthy."""
    snap = scenario_conditions(scenario or config.scenario(), as_of)
    if config.live_weather():
        try:
            snap.weather = open_meteo_weather(points, as_of)
            snap.source["weather"] = "open-meteo"
            snap.summary = "Live forecast" + (f": {', '.join(sorted({z.kind for z in snap.weather}))}" if snap.weather else ": no winter weather")
        except Exception as e:
            log.warning("live weather unavailable (%s); using demo scenario", e)
            snap.source["weather"] += " (live weather unavailable)"
    feed = config.road_events_url()
    if feed:
        try:
            snap.road_events = geojson_road_events(feed)
            snap.source["roads"] = "feed"
        except Exception as e:
            log.warning("road events feed unavailable (%s); using demo scenario", e)
            snap.source["roads"] += " (road feed unavailable)"
    return snap
