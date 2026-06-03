"""Nominatim geocoder — destination + manual-location fallback (CLAUDE.md §11).

Keyless (OpenStreetMap). Their usage policy requires a real User-Agent and low
request rates; we only geocode on explicit user input, so volume is tiny.
"""

from __future__ import annotations

import httpx
from pydantic import BaseModel


class GeocodeResult(BaseModel):
    latitude: float
    longitude: float
    display_name: str


class Geocoder:
    def __init__(self, base_url: str, user_agent: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"User-Agent": user_agent}

    async def geocode(self, query: str) -> GeocodeResult | None:
        params = {
            "q": query,
            "format": "jsonv2",
            "limit": "1",
            "countrycodes": "au",
        }
        async with httpx.AsyncClient(timeout=15.0, headers=self._headers) as client:
            resp = await client.get(f"{self._base_url}/search", params=params)
            resp.raise_for_status()
            results = resp.json()
        if not results:
            return None
        top = results[0]
        return GeocodeResult(
            latitude=float(top["lat"]),
            longitude=float(top["lon"]),
            display_name=top.get("display_name", query),
        )
