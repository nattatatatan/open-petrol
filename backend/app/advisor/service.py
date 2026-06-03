"""Advisor service — the three-layer "fill up now or wait?" feature (CLAUDE.md §6).

Layer 1 (here + engine/cycle.py): deterministic facts — the source of truth.
Layer 2 (llm.py): Claude phrases / answers free-text using ONLY those facts.
Layer 3 (frontend): shows the verdict + the basis.

The deterministic layer always produces a complete answer, so the feature works
fully with no Anthropic key; the LLM is a pure enhancement for free-text questions.
"""

from __future__ import annotations

from pydantic import BaseModel

from app.cache.store import PriceCache
from app.config import Settings
from app.engine.cycle import CycleAssessment, assess_cycle
from app.engine.recommend import _prices_for_fuel
from app.models import FUEL_TYPE_LABELS
from app.sources.base import FuelSource


class AdvisorResult(BaseModel):
    verdict: str                              # fill_now | wait | cheapest_now
    headline: str
    detail: str
    confidence: str
    phase: str | None
    wait_days: int | None
    expected_saving_per_tank: float | None
    basis: str
    source: str                               # "deterministic" | "llm"
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


def build_deterministic(
    cycle: CycleAssessment, *, fuel: str, tank: float, rec: dict | None
) -> AdvisorResult:
    label = FUEL_TYPE_LABELS.get(fuel, fuel)

    if cycle.verdict == "cheapest_now":
        detail = "Not enough recent price history to call the cycle confidently."
        if rec:
            detail += f" Right now the best option is {rec['name']} at {rec['price']:.1f}c/L."
        return AdvisorResult(
            verdict="cheapest_now",
            headline="Just grab the cheapest now",
            detail=detail,
            confidence="low",
            phase=cycle.phase,
            wait_days=None,
            expected_saving_per_tank=None,
            basis="Based on the cheapest current price — not a timing prediction.",
            source="deterministic",
            recommended_station=rec,
        )

    basis = (
        f"Based on the last few weeks of {label} area lows "
        f"(low {cycle.recent_low}c, high {cycle.recent_high}c, today {cycle.current_low}c)."
    )

    if cycle.verdict == "wait":
        save = cycle.expected_saving_per_tank
        headline = f"Worth waiting ~{cycle.wait_days} days" if cycle.wait_days else "Worth waiting"
        detail = (
            f"Prices are near their recent peak ({cycle.current_low}c). "
            + (f"Waiting could save about ${save:.2f} on a {tank:.0f}L tank if the cycle drops as usual."
               if save and save > 0 else "They typically fall soon from here.")
        )
        return AdvisorResult(
            verdict="wait", headline=headline, detail=detail, confidence=cycle.confidence,
            phase=cycle.phase, wait_days=cycle.wait_days, expected_saving_per_tank=save,
            basis=basis, source="deterministic", recommended_station=rec,
        )

    # fill_now
    if cycle.phase == "near_trough":
        detail = f"Prices are near their recent low ({cycle.current_low}c) and usually climb from here."
    else:
        detail = "Prices are on the way up — fill before they climb further."
    return AdvisorResult(
        verdict="fill_now", headline="Fill up now", detail=detail, confidence=cycle.confidence,
        phase=cycle.phase, wait_days=None, expected_saving_per_tank=None,
        basis=basis, source="deterministic", recommended_station=rec,
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
        question: str | None = None,
        recommended_station_code: str | None = None,
    ) -> AdvisorResult:
        lows = await self._source.get_historical_lows(fuel, area, days=42)
        cycle = assess_cycle(lows, tank)
        rec = _recommended_info(self._cache, fuel, recommended_station_code)
        deterministic = build_deterministic(cycle, fuel=fuel, tank=tank, rec=rec)

        # The LLM only earns its keep on free-text (CLAUDE.md §6). No question, or no
        # key -> deterministic. Any LLM failure -> deterministic.
        if question and self._settings.anthropic_api_key:
            from app.advisor.llm import phrase_with_claude

            try:
                return await phrase_with_claude(
                    settings=self._settings,
                    question=question,
                    cycle=cycle,
                    deterministic=deterministic,
                    fuel=fuel,
                    tank=tank,
                )
            except Exception:  # noqa: BLE001 - degrade to deterministic on ANY failure
                return deterministic
        return deterministic
