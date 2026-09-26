"""
Runtime configuration, all from environment variables (see .env.example).

Defaults are DEMO MODE: no network calls, deterministic synthetic conditions.
Every live integration is opt-in and falls back to demo data on any failure.
"""

from __future__ import annotations

import os


def _flag(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in {"1", "true", "yes", "on"}


def backend_url() -> str | None:
    """Backend base URL (feature/backend). Unset → use the bundled synthetic snapshot."""
    url = os.environ.get("HERA_API_URL", "").strip().rstrip("/")
    return url or None


def demo_mode() -> bool:
    """HERA_DEMO_MODE=1 forces every adapter to deterministic mock data, even if live flags are set."""
    return _flag("HERA_DEMO_MODE")


def live_weather() -> bool:
    return _flag("HERA_LIVE_WEATHER") and not demo_mode()


def live_routing() -> bool:
    return _flag("HERA_LIVE_ROUTING") and not demo_mode()


def scenario() -> str:
    """Which deterministic conditions scenario to load from data/conditions_scenarios.json."""
    return os.environ.get("HERA_CONDITIONS_SCENARIO", "winter_storm").strip() or "winter_storm"


HOST = os.environ.get("HERA_MAP_HOST", "127.0.0.1")
PORT = int(os.environ.get("HERA_MAP_PORT", "8001"))
BACKEND_TIMEOUT_S = float(os.environ.get("HERA_BACKEND_TIMEOUT_S", "1.5"))
LIVE_TIMEOUT_S = float(os.environ.get("HERA_LIVE_TIMEOUT_S", "2.5"))
