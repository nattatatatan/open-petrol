"""Route-aware recommendation — the PRIMARY flow ("On my way to…", CLAUDE.md §7.5).

Research (RESEARCH.md) shows refuelling is trip-integrated: drivers fill up along a
route they're already driving and weigh DETOUR FROM ROUTE, not distance from a point.
So the search space is a corridor around the route, the cost primitive is added
detour, and ranking is on net benefit = saving vs baseline − detour cost.

Performance pattern (§7.5): cheap corridor pre-filter (perpendicular distance to the
polyline) to shortlist, then precise via-route detour only on the top few candidates —
never via-route every station.
"""

from __future__ import annotations

import asyncio
from datetime import datetime

from pydantic import BaseModel

from app.engine.geo import point_to_polyline_km
from app.engine.recommend import (
    DEFAULT_CONSUMPTION_L_PER_KM,
    DEFAULT_MAX_RESULTS,
    DEFAULT_TANK_L,
    Baseline,
    StationOffer,
    build_offer,
    compute_baseline,
    rank_and_select,
    _prices_for_fuel,
)
from app.engine.discounts import MembershipSelection, resolve_discounts
from app.models import Snapshot
from app.routing.osrm import Point, RoutingService

DEFAULT_CORRIDOR_BUFFER_KM = 2.0
DEFAULT_MAX_VIA_CANDIDATES = 8


class RouteRankResult(BaseModel):
    fuel_type: str
    captured_at: datetime
    tank_l: float
    baseline: Baseline
    origin: Point
    destination: Point
    route_geometry: list[Point]
    direct_distance_km: float
    direct_duration_min: float
    offers: list[StationOffer]
    recommended: StationOffer | None


async def recommend_along_route(
    snapshot: Snapshot,
    routing: RoutingService,
    *,
    origin: Point,
    destination: Point,
    fuel_type: str,
    tank_l: float = DEFAULT_TANK_L,
    usual_station_code: str | None = None,
    membership: MembershipSelection | None = None,
    consumption_l_per_km: float = DEFAULT_CONSUMPTION_L_PER_KM,
    corridor_buffer_km: float = DEFAULT_CORRIDOR_BUFFER_KM,
    max_via_candidates: int = DEFAULT_MAX_VIA_CANDIDATES,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> RouteRankResult:
    direct = (await routing.route([origin, destination], alternatives=False))[0]

    prices = _prices_for_fuel(snapshot, fuel_type)
    resolved = resolve_discounts(
        snapshot.stations, fuel_type, membership or MembershipSelection()
    )
    discounts = {code: cents for code, (cents, _) in resolved.items()}
    stations = {s.code: s for s in snapshot.stations}

    # 1) Cheap corridor pre-filter: perpendicular distance to the route polyline.
    corridor: list[tuple[str, float]] = []
    for code in prices:
        station = stations.get(code)
        if station is None:
            continue
        perp = point_to_polyline_km(
            (station.location.latitude, station.location.longitude),
            direct.geometry,
        )
        if perp <= corridor_buffer_km:
            corridor.append((code, perp))

    # Baseline = the average ALONG THE CORRIDOR (honest "best value on your way"),
    # not all-NSW. Usual-station baseline still resolves from the full snapshot.
    baseline = compute_baseline(
        {code: prices[code] for code, _ in corridor},
        usual_station_code, discounts,
        usual_price=prices.get(usual_station_code) if usual_station_code else None,
    )

    # Via-route only the nearest few candidates (don't route every corridor station).
    corridor.sort(key=lambda x: x[1])
    shortlist = corridor[:max_via_candidates]

    # 2) Precise via-route detour only for the shortlist (run concurrently).
    async def _offer(code: str, perp: float) -> StationOffer:
        station = stations[code]
        via: Point = (station.location.latitude, station.location.longitude)
        detour = await routing.detour(origin, via, destination, direct)
        return build_offer(
            station, prices[code],
            baseline=baseline,
            reference_time=snapshot.captured_at,
            distance_km=perp,
            detour_km=detour.extra_km,
            tank_l=tank_l,
            consumption_l_per_km=consumption_l_per_km,
            discount=discounts.get(code, 0.0),
            discount_label=resolved.get(code, (0.0, None))[1],
            detour_min=detour.extra_min,
            along_route_km=detour.along_route_km,
        )

    offers = list(await asyncio.gather(*(_offer(c, p) for c, p in shortlist)))
    ranked, recommended = rank_and_select(offers, max_results)

    return RouteRankResult(
        fuel_type=fuel_type,
        captured_at=snapshot.captured_at,
        tank_l=tank_l,
        baseline=baseline,
        origin=origin,
        destination=destination,
        route_geometry=direct.geometry,
        direct_distance_km=round(direct.distance_km, 2),
        direct_duration_min=round(direct.duration_min, 1),
        offers=ranked,
        recommended=recommended,
    )
