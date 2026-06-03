"""The recommendation engine — deterministic, pure, the source of truth.

No AI here (CLAUDE.md §6): every number a user acts on is computed here from cached
real data. The AI layer may only phrase these results.

Core product decisions encoded (CLAUDE.md §7):
  * Everything is scoped to ONE fuel type.
  * "Save $X" is always vs an explicit baseline (usual station, else area average).
  * "Cheapest" means cheapest NET OF DETOUR — we don't send someone 14km to save 3c/L.
  * Each price carries its own freshness; stale prices are de-ranked and flagged.
"""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.engine.geo import haversine_km
from app.models import Freshness, Price, Snapshot, Station, classify_freshness

DEFAULT_TANK_L = 55.0
DEFAULT_CONSUMPTION_L_PER_KM = 0.08  # ~8 L/100km
DEFAULT_RADIUS_KM = 8.0
DEFAULT_MAX_RESULTS = 12
# Near-me: choosing a station X km away costs you the round trip out and back.
NEAR_ME_ROUND_TRIP = 2.0


class Baseline(BaseModel):
    kind: str          # "usual_station" | "area_average"
    price: float       # cents/L
    label: str


class StationOffer(BaseModel):
    station_code: str
    name: str
    brand: str | None
    address: str | None
    latitude: float
    longitude: float
    fuel_type: str
    price: float                 # cents/L
    last_updated: datetime
    freshness: Freshness
    distance_km: float
    detour_km: float
    saving_per_litre: float      # cents/L vs baseline (can be negative)
    saving_per_tank: float       # dollars vs baseline for a full tank
    detour_cost: float           # dollars of fuel burned getting there
    net_benefit: float           # dollars = saving_per_tank - detour_cost
    is_recommended: bool = False
    # Route-mode only (None for "near me now"):
    detour_min: float | None = None       # extra minutes vs the direct route
    along_route_km: float | None = None   # how far into the trip this stop falls


class RankResult(BaseModel):
    fuel_type: str
    captured_at: datetime
    tank_l: float
    baseline: Baseline
    offers: list[StationOffer]
    recommended: StationOffer | None


def _prices_for_fuel(snapshot: Snapshot, fuel_type: str) -> dict[str, Price]:
    """Latest price per station for the requested fuel (keeps the freshest if a
    station somehow has duplicates)."""
    out: dict[str, Price] = {}
    for p in snapshot.prices:
        if p.fuel_type != fuel_type:
            continue
        existing = out.get(p.station_code)
        if existing is None or p.last_updated > existing.last_updated:
            out[p.station_code] = p
    return out


def compute_baseline(
    prices: dict[str, Price], usual_station_code: str | None
) -> Baseline:
    """Baseline = the user's usual station if we have a price for it; otherwise the
    area average. Never an unanchored number (CLAUDE.md §7)."""
    if usual_station_code and usual_station_code in prices:
        return Baseline(
            kind="usual_station",
            price=prices[usual_station_code].price,
            label="your usual station",
        )
    avg = sum(p.price for p in prices.values()) / len(prices)
    return Baseline(kind="area_average", price=round(avg, 1), label="the area average")


def build_offer(
    station: Station,
    price: Price,
    *,
    baseline: Baseline,
    reference_time: datetime,
    distance_km: float,
    detour_km: float,
    tank_l: float,
    consumption_l_per_km: float,
    detour_min: float | None = None,
    along_route_km: float | None = None,
) -> StationOffer:
    saving_per_litre = baseline.price - price.price
    saving_per_tank = saving_per_litre * tank_l / 100.0
    detour_cost = detour_km * consumption_l_per_km * (price.price / 100.0)
    return StationOffer(
        station_code=station.code,
        name=station.name,
        brand=station.brand,
        address=station.address,
        latitude=station.location.latitude,
        longitude=station.location.longitude,
        fuel_type=price.fuel_type,
        price=price.price,
        last_updated=price.last_updated,
        freshness=classify_freshness(price.last_updated, reference_time),
        distance_km=round(distance_km, 2),
        detour_km=round(detour_km, 2),
        saving_per_litre=round(saving_per_litre, 1),
        saving_per_tank=round(saving_per_tank, 2),
        detour_cost=round(detour_cost, 2),
        net_benefit=round(saving_per_tank - detour_cost, 2),
        detour_min=round(detour_min, 1) if detour_min is not None else None,
        along_route_km=along_route_km,
    )


def _rank(offers: list[StationOffer]) -> list[StationOffer]:
    """Rank on net benefit, but sink stale prices below trustworthy ones
    (de-ranking, CLAUDE.md §4)."""
    return sorted(
        offers,
        key=lambda o: (o.freshness is Freshness.STALE, -o.net_benefit),
    )


def rank_and_select(
    offers: list[StationOffer], max_results: int
) -> tuple[list[StationOffer], StationOffer | None]:
    """Shared ranking used by both near-me and route modes: rank net of detour
    (stale de-ranked), cap the list, and flag the top as recommended."""
    ranked = _rank(offers)[:max_results]
    recommended = ranked[0] if ranked else None
    if recommended is not None:
        recommended.is_recommended = True
    return ranked, recommended


def _finalize(
    offers: list[StationOffer], *, fuel_type: str, captured_at: datetime,
    tank_l: float, baseline: Baseline, max_results: int,
) -> RankResult:
    ranked, recommended = rank_and_select(offers, max_results)
    return RankResult(
        fuel_type=fuel_type,
        captured_at=captured_at,
        tank_l=tank_l,
        baseline=baseline,
        offers=ranked,
        recommended=recommended,
    )


def find_cheapest_stations(
    snapshot: Snapshot,
    *,
    origin_lat: float,
    origin_lng: float,
    fuel_type: str,
    tank_l: float = DEFAULT_TANK_L,
    radius_km: float = DEFAULT_RADIUS_KM,
    usual_station_code: str | None = None,
    consumption_l_per_km: float = DEFAULT_CONSUMPTION_L_PER_KM,
    max_results: int = DEFAULT_MAX_RESULTS,
) -> RankResult:
    """'Cheapest near me, now', ranked net of the round-trip detour to get there."""
    prices = _prices_for_fuel(snapshot, fuel_type)
    baseline = compute_baseline(prices, usual_station_code)
    stations = {s.code: s for s in snapshot.stations}

    offers: list[StationOffer] = []
    for code, price in prices.items():
        station = stations.get(code)
        if station is None:
            continue
        dist = haversine_km(
            origin_lat, origin_lng,
            station.location.latitude, station.location.longitude,
        )
        if dist > radius_km:
            continue
        offers.append(
            build_offer(
                station, price,
                baseline=baseline,
                reference_time=snapshot.captured_at,
                distance_km=dist,
                detour_km=dist * NEAR_ME_ROUND_TRIP,
                tank_l=tank_l,
                consumption_l_per_km=consumption_l_per_km,
            )
        )

    return _finalize(
        offers, fuel_type=fuel_type, captured_at=snapshot.captured_at,
        tank_l=tank_l, baseline=baseline, max_results=max_results,
    )
