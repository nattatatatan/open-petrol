"""OSRM routing adapter — geometry ONLY.

Route-awareness needs route geometry and detour distances (CLAUDE.md §7.5); prices
still come entirely from our cache, so grounding is untouched. We use the free
public OSRM server (no key); self-hosting is the production path. Coordinates are
(lat, lng) on our side; OSRM wants lng,lat.
"""

from __future__ import annotations

import httpx
from pydantic import BaseModel

Point = tuple[float, float]  # (lat, lng)


class Route(BaseModel):
    geometry: list[Point]      # [(lat, lng), ...]
    distance_km: float
    duration_min: float
    leg_distances_km: list[float]  # per-leg distance, e.g. origin->via, via->dest


class Detour(BaseModel):
    extra_km: float
    extra_min: float
    along_route_km: float      # distance from origin to the via point along the route


class RoutingService:
    def __init__(self, base_url: str, user_agent: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._headers = {"User-Agent": user_agent}

    @staticmethod
    def _coords(points: list[Point]) -> str:
        return ";".join(f"{lng},{lat}" for lat, lng in points)

    async def route(self, points: list[Point], alternatives: bool = False) -> list[Route]:
        url = f"{self._base_url}/route/v1/driving/{self._coords(points)}"
        params = {
            "overview": "full",
            "geometries": "geojson",
            "alternatives": "true" if alternatives else "false",
        }
        async with httpx.AsyncClient(timeout=20.0, headers=self._headers) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            raise RuntimeError(f"OSRM returned no route: {data.get('code')}")
        return [self._parse_route(r) for r in data["routes"]]

    @staticmethod
    def _parse_route(r: dict) -> Route:
        coords = r["geometry"]["coordinates"]  # [lng, lat]
        return Route(
            geometry=[(lat, lng) for lng, lat in coords],
            distance_km=r["distance"] / 1000.0,
            duration_min=r["duration"] / 60.0,
            leg_distances_km=[leg["distance"] / 1000.0 for leg in r.get("legs", [])],
        )

    async def detour(self, origin: Point, via: Point, dest: Point, direct: Route) -> Detour:
        """Extra distance/time to divert through `via` vs the direct route."""
        viad = (await self.route([origin, via, dest]))[0]
        along = viad.leg_distances_km[0] if viad.leg_distances_km else 0.0
        return Detour(
            extra_km=max(0.0, viad.distance_km - direct.distance_km),
            extra_min=max(0.0, viad.duration_min - direct.duration_min),
            along_route_km=round(along, 2),
        )
