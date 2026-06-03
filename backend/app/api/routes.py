"""HTTP API. Stateless: the user model (fuel, tank, usual station) is passed per
request and persisted client-side. Every response is served from the cache — these
handlers never call FuelCheck (CLAUDE.md §2)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from app.advisor.service import AdvisorResult
from app.engine.recommend import (
    DEFAULT_RADIUS_KM,
    DEFAULT_TANK_L,
    RankResult,
    find_cheapest_stations,
)
from app.engine.route import RouteRankResult, recommend_along_route
from app.models import FUEL_TYPE_LABELS, Freshness, classify_freshness

router = APIRouter(prefix="/api")


def _cache(request: Request):
    return request.app.state.cache


def _require_snapshot(request: Request):
    snap = _cache(request).get_snapshot()
    if snap is None:
        raise HTTPException(503, "Price data is still loading. Try again shortly.")
    return snap


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/meta")
async def meta(request: Request):
    """Data-freshness + provenance for the trust banner (CLAUDE.md §4)."""
    cache = _cache(request)
    status = cache.status()
    snap = cache.get_snapshot()
    counts = {"fresh": 0, "ageing": 0, "stale": 0}
    if snap is not None:
        for p in snap.prices:
            counts[classify_freshness(p.last_updated, snap.captured_at).value] += 1
    return {
        "source": request.app.state.source.name,
        "captured_at": status.captured_at,
        "fetched_at": status.fetched_at,
        "last_success_at": status.last_success_at,
        "stale_refresh": status.stale_refresh,
        "last_error": status.last_error,
        "station_count": len(snap.stations) if snap else 0,
        "price_count": len(snap.prices) if snap else 0,
        "freshness_breakdown": counts,
        "fuel_types": FUEL_TYPE_LABELS,
        "provider": "NSW FuelCheck",
        "now": datetime.now(timezone.utc),
    }


@router.get("/near-me", response_model=RankResult)
async def near_me(
    request: Request,
    lat: float = Query(...),
    lng: float = Query(...),
    fuel: str = Query("E10"),
    tank: float = Query(DEFAULT_TANK_L, gt=0, le=200),
    radius: float = Query(DEFAULT_RADIUS_KM, gt=0, le=50),
    usual_station: str | None = Query(None),
) -> RankResult:
    snap = _require_snapshot(request)
    return find_cheapest_stations(
        snap, origin_lat=lat, origin_lng=lng, fuel_type=fuel,
        tank_l=tank, radius_km=radius, usual_station_code=usual_station,
    )


@router.get("/on-my-way", response_model=RouteRankResult)
async def on_my_way(
    request: Request,
    origin_lat: float = Query(...),
    origin_lng: float = Query(...),
    fuel: str = Query("E10"),
    tank: float = Query(DEFAULT_TANK_L, gt=0, le=200),
    usual_station: str | None = Query(None),
    dest: str | None = Query(None, description="Free-text destination (geocoded)"),
    dest_lat: float | None = Query(None),
    dest_lng: float | None = Query(None),
) -> RouteRankResult:
    snap = _require_snapshot(request)

    if dest_lat is not None and dest_lng is not None:
        destination = (dest_lat, dest_lng)
    elif dest:
        result = await request.app.state.geocoder.geocode(dest)
        if result is None:
            raise HTTPException(404, f"Couldn't find a location for '{dest}'.")
        destination = (result.latitude, result.longitude)
    else:
        raise HTTPException(422, "Provide either dest (text) or dest_lat & dest_lng.")

    try:
        return await recommend_along_route(
            snap, request.app.state.routing,
            origin=(origin_lat, origin_lng), destination=destination,
            fuel_type=fuel, tank_l=tank, usual_station_code=usual_station,
        )
    except RuntimeError as exc:
        raise HTTPException(502, f"Routing failed: {exc}")


@router.get("/geocode")
async def geocode(request: Request, q: str = Query(..., min_length=2)):
    """Manual-location / destination lookup (CLAUDE.md §11)."""
    result = await request.app.state.geocoder.geocode(q)
    if result is None:
        raise HTTPException(404, f"No match for '{q}'.")
    return result


class AdvisorRequest(BaseModel):
    fuel: str = "E10"
    area: str = "Sydney"
    tank: float = Field(55, gt=0, le=200)
    question: str | None = Field(None, max_length=280)  # length cap (CLAUDE.md §11)
    recommended_station_code: str | None = None


@router.post("/advisor", response_model=AdvisorResult)
async def advisor(request: Request, body: AdvisorRequest) -> AdvisorResult:
    """'Fill up now or wait?' — grounded in the cached price-cycle (CLAUDE.md §6)."""
    return await request.app.state.advisor.advise(
        fuel=body.fuel, area=body.area, tank=body.tank,
        question=body.question, recommended_station_code=body.recommended_station_code,
    )
