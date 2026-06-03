"""Price-cycle heuristic — deterministic, explainable, NOT ML (CLAUDE.md §6, §10).

Reasons over the recent daily-lows series to answer "fill up now or wait?". Sydney's
cycle is a slow rise then a sharp drop, but it's irregular and can spike right after a
trough — so we BIAS CONSERVATIVE (default to "fill now"), only advise waiting when
prices are clearly near a peak, and fall back to "cheapest now" when there isn't
enough signal. Every number here is computed, never predicted by an LLM.
"""

from __future__ import annotations

from statistics import mean

from pydantic import BaseModel

from app.models import DailyLow

MIN_HISTORY_DAYS = 10
WINDOW_DAYS = 21
NEAR_TROUGH = 0.25       # position in range below which it's cheap (fill now)
NEAR_PEAK = 0.80         # position above which a drop is plausible (consider waiting)
MIN_RANGE_CENTS = 6.0    # if the recent spread is smaller, the cycle isn't actionable
TREND_DAYS = 3


class CycleAssessment(BaseModel):
    verdict: str                          # "fill_now" | "wait" | "cheapest_now"
    phase: str | None                     # rising | falling | near_peak | near_trough | flat
    position_in_range: float | None       # 0 (recent low) .. 1 (recent high)
    trend_cents_per_day: float | None
    wait_days: int | None
    expected_saving_per_tank: float | None
    confidence: str                       # "high" | "low"
    recent_low: float | None
    recent_high: float | None
    current_low: float | None


def _low_confidence(reason_phase: str | None = None) -> CycleAssessment:
    return CycleAssessment(
        verdict="cheapest_now", phase=reason_phase, position_in_range=None,
        trend_cents_per_day=None, wait_days=None, expected_saving_per_tank=None,
        confidence="low", recent_low=None, recent_high=None, current_low=None,
    )


def assess_cycle(lows: list[DailyLow], tank_l: float) -> CycleAssessment:
    if len(lows) < MIN_HISTORY_DAYS:
        return _low_confidence()

    series = [r.price for r in lows][-WINDOW_DAYS:]
    recent_low, recent_high = min(series), max(series)
    rng = recent_high - recent_low
    if rng < MIN_RANGE_CENTS:
        # Flat market — no worthwhile timing play.
        return _low_confidence("flat")

    current = series[-1]
    position = (current - recent_low) / rng
    trend = mean(series[-TREND_DAYS:]) - mean(series[-2 * TREND_DAYS : -TREND_DAYS])

    if position >= NEAR_PEAK:
        phase, verdict, wait_days = "near_peak", "wait", 3
    elif position <= NEAR_TROUGH:
        phase, verdict, wait_days = "near_trough", "fill_now", None
    elif trend < -0.3 and position > 0.5:
        phase, verdict, wait_days = "falling", "wait", 4
    elif trend > 0.3:
        phase, verdict, wait_days = "rising", "fill_now", None
    else:
        phase, verdict, wait_days = "flat", "fill_now", None

    expected_saving = (
        round((current - recent_low) * tank_l / 100.0, 2) if verdict == "wait" else None
    )

    return CycleAssessment(
        verdict=verdict,
        phase=phase,
        position_in_range=round(position, 2),
        trend_cents_per_day=round(trend, 2),
        wait_days=wait_days,
        expected_saving_per_tank=expected_saving,
        confidence="high",
        recent_low=round(recent_low, 1),
        recent_high=round(recent_high, 1),
        current_low=round(current, 1),
    )
