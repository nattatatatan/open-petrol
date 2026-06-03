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

    async def _search(self, query: str, limit: int) -> list[dict]:
        params = {
            "q": query,
            "format": "jsonv2",
            "limit": str(limit),
            "countrycodes": "au",
        }
        async with httpx.AsyncClient(timeout=15.0, headers=self._headers) as client:
            resp = await client.get(f"{self._base_url}/search", params=params)
            resp.raise_for_status()
            return resp.json()

    @staticmethod
    def _to_result(r: dict, fallback: str) -> GeocodeResult:
        return GeocodeResult(
            latitude=float(r["lat"]),
            longitude=float(r["lon"]),
            display_name=r.get("display_name", fallback),
        )

    async def geocode(self, query: str) -> GeocodeResult | None:
        results = await self._search(query, 1)
        return self._to_result(results[0], query) if results else None

    async def suggest(self, query: str, limit: int = 5) -> list[GeocodeResult]:
        """Autocomplete suggestions for origin/destination entry (CLAUDE.md §5, §11).
        Only called on explicit, debounced user input, so request volume stays low."""
        return [self._to_result(r, query) for r in await self._search(query, limit)]
