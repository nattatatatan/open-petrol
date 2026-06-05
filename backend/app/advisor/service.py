"""Advisor service — the "fill up now or wait?" feature (CLAUDE.md §6).

Two layers, no LLM:
  1. engine/cycle.py — the deterministic classifier: the source of truth. It returns
     a verdict, the confidence it was reached with, the signals, and a factual `basis`.
  2. here — a PURE PRESENTATION layer: it maps the verdict to glanceable headline +
     detail copy and passes the classifier's `basis` through untouched.

Timing is a prediction problem, not a language problem, so there is no model and no
network on this path — the verdict reads only from the cached daily-low series.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from pydantic import BaseModel

from app.cache.store import PriceCache
from app.config import Settings
from app.engine.cycle import CycleAssessment, assess_cycle
from app.engine.recommend import _prices_for_fuel
from app.models import FUEL_TYPE_LABELS
from app.sources.base import FuelSource


class AdvisorResult(BaseModel):
    verdict: str                              # fill_now | fill_only_needed | wait | uncertain
    headline: str
    detail: str
    basis: str                               # the real numbers behind the verdict
    confidence: float                        # 0..1
    expected_saving_per_tank: float | None
    recommended_station: dict | None = None


def _recommended_info(cache: PriceCache, fuel: str, code: str | None) -> dict | None:
    if not code:
        return None
    snap = cache.get_snapshot()
    if snap is None:
        return None
    station = next((s for s in snap.stations if s.code == code), None)
    price = _prices_for_fuel(snap, fuel).get(code)
    if station is None or price is None:
        return None
    return {"name": station.name, "price": price.price}


# Verdict -> glanceable copy. The advisor is a MODIFIER on the finder's
# recommendation (CLAUDE.md §7.5): it reinforces, softens, or qualifies the picked
# station — it is never a separate answer. `uncertain` is rendered as nothing by the
# UI; we still return honest copy for completeness/testing.
def build_deterministic(
    cycle: CycleAssessment, *, fuel: str, tank: float, rec: dict | None
) -> AdvisorResult:
    label = FUEL_TYPE_LABELS.get(fuel, fuel)
    station = rec["name"] if rec else "the cheapest station"

    if cycle.verdict == "fill_now":
        headline = "Good time to fill up"
        detail = f"{label} is near its recent low and starting to climb — worth filling at {station} now."

    elif cycle.verdict == "wait":
        save = cycle.expected_saving_per_tank
        headline = "Cheapest today — but prices look high"
        detail = (
            f"{station} is the best {label} price right now, but the area is near its cycle peak"
            + (
                f"; waiting could save about ${save:.2f} on a {tank:.0f}L fill if it drops as usual."
                if save and save > 0
                else " and may fall soon — top up only if you need to."
            )
        )

    elif cycle.verdict == "fill_only_needed":
        headline = "Fill if you need to"
        detail = (
            f"{label} prices are mid-cycle — no clear win from timing it. "
            f"{station} is your cheapest option if you're filling today."
        )

    else:  # uncertain
        headline = "Just grab the cheapest now"
        detail = (
            f"Not enough recent {label} price history to call the cycle — "
            f"{station} is your cheapest option right now."
        )

    return AdvisorResult(
        verdict=cycle.verdict,
        headline=headline,
        detail=detail,
        basis=cycle.basis,
        confidence=cycle.confidence,
        expected_saving_per_tank=cycle.expected_saving_per_tank,
        recommended_station=rec,
    )


class AdvisorService:
    def __init__(self, settings: Settings, cache: PriceCache, source: FuelSource) -> None:
        self._settings = settings
        self._cache = cache
        self._source = source

    async def advise(
        self,
        *,
        fuel: str,
        area: str,
        tank: float,
        recommended_station_code: str | None = None,
    ) -> AdvisorResult:
        lows = await self._source.get_historical_lows(fuel, area, days=42)
        # Anchor staleness to the snapshot's day for the demo; live data is "today".
        now = self._reference_date()
        cycle = assess_cycle(lows, tank, now=now)
        rec = _recommended_info(self._cache, fuel, recommended_station_code)
        return build_deterministic(cycle, fuel=fuel, tank=tank, rec=rec)

    def _reference_date(self) -> date:
        snap = self._cache.get_snapshot()
        if snap is not None:
            return snap.captured_at.date()
        return datetime.now(timezone.utc).date()
