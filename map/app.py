"""Hosting entry point (e.g. Vercel's Python runtime): the access-map service as a WSGI app.

Locally, run `python3 -m hera_map.server` instead.
"""

from hera_map.server import app  # noqa: F401
