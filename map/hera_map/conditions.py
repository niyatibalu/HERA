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
