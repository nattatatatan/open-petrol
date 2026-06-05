"""Price-cycle classifier — deterministic, explainable, NOT ML (CLAUDE.md §6, §10).

Timing is a PREDICTION problem, not a language problem, so it is solved with an
explainable rule-based classifier over the cached daily area-low series — never an
LLM and never a learned model. Every number here is computed from the series; the
copy layer (advisor/service.py) only phrases the result and quotes these numbers.

Sydney's cycle is a slow rise then a sharp drop, but it is irregular and lengthening,
so a confident-but-wrong "wait" right before a hike is the worst outcome. We therefore
BIAS CONFIDENCE LOW (it is a product of independent data-quality factors, so any weak
factor pulls the whole thing down) and fall back to an honest "uncertain" whenever the
signal isn't strong enough to act on.

The classifier reads ONLY from the cached series — no network is on this path.
"""

from __future__ import annotations

from datetime import date

from pydantic import BaseModel

from app.models import DailyLow


class CycleConfig:
    """Every tunable lives here (CLAUDE.md §6) — thresholds are policy, not magic
    numbers scattered through the logic. Adjust the cycle's behaviour from one place."""

    # --- signal windows ---
    PERCENTILE_WINDOW_DAYS = 30      # window the current price's percentile is measured in
    TREND_SHORT_DAYS = 7            # "this week" trend
    TREND_LONG_DAYS = 14           # fortnight trend (context, not a trigger)
    EXTREMA_LOOKBACK_DAYS = 30      # window for days-since local min/max

    # --- confidence inputs (bias LOW) ---
    MIN_HISTORY_DAYS = 21           # below this we can't read a ~4-week cycle at all
    HISTORY_FULL_DAYS = 30          # history score reaches 1.0 here
    MIN_CYCLE_AMPLITUDE_CENTS = 8.0  # a flatter market has no actionable cycle
    AMPLITUDE_FULL_CENTS = 16.0     # amplitude score reaches 1.0 here
    MAX_STALE_DAYS = 3              # newest point older than this => no usable signal

    # --- verdict thresholds ---
    MIN_CONFIDENCE = 0.6            # below this => "uncertain", never a timing call
    LOW_PERCENTILE = 25            # at/under this the price is "cheap" within the window
    HIGH_PERCENTILE = 75           # at/over this the price is "expensive" within the window


Verdict = str  # "fill_now" | "fill_only_needed" | "wait" | "uncertain"


class CycleAssessment(BaseModel):
    """The full, inspectable output of the classifier: the verdict, the confidence it
    was reached with, every signal that drove it, and a factual human-readable basis."""

    verdict: Verdict
    confidence: float                     # 0..1, biased low

    # signals (all deterministic, from the cached series)
    seven_day_trend: float | None         # signed c/L change over TREND_SHORT_DAYS
    fourteen_day_trend: float | None      # signed c/L change over TREND_LONG_DAYS
    cycle_percentile: float | None        # 0..100, current price's rank in the window
    days_since_local_minimum: int | None
    days_since_local_maximum: int | None
    consecutive_rising_days: int | None
    consecutive_falling_days: int | None

    # supporting numbers (for copy + the basis string)
    current_price: float | None
    window_low: float | None
    window_high: float | None
    amplitude: float | None
    history_days: int
    expected_saving_per_tank: float | None

    # the trust mechanism: the real numbers that produced the verdict
    basis: str


# --------------------------------------------------------------------------- #
# Signals — each is a small pure function so it can be unit-tested in isolation.
# --------------------------------------------------------------------------- #

def percentile_rank(window: list[float], value: float) -> float:
    """Percent of days in `window` strictly cheaper than `value` (0..100). Near 0 =>
    `value` is among the cheapest in the window; near 100 => among the dearest."""
    if not window:
        return 0.0
    below = sum(1 for v in window if v < value)
    return round(below / len(window) * 100, 1)


def trend_over(series: list[float], days: int) -> float:
    """Signed c/L change across the last `days` steps (positive = rising)."""
    if len(series) <= days:
        return round(series[-1] - series[0], 2)
    return round(series[-1] - series[-(days + 1)], 2)


def running_streaks(series: list[float]) -> tuple[int, int]:
    """(consecutive rising days, consecutive falling days) counting back from today.
    Only one can be non-zero."""
    rising = falling = 0
    for i in range(len(series) - 1, 0, -1):
        if series[i] > series[i - 1]:
            if falling:
                break
            rising += 1
        elif series[i] < series[i - 1]:
            if rising:
                break
            falling += 1
        else:
            break
    return rising, falling


def days_since_extrema(window: list[float]) -> tuple[int, int]:
    """(days since the most recent local minimum, days since the most recent local
    maximum) within `window`. 0 means it is today's price."""
    last = len(window) - 1
    lo = max(i for i, v in enumerate(window) if v == min(window))
    hi = max(i for i, v in enumerate(window) if v == max(window))
    return last - lo, last - hi


# --------------------------------------------------------------------------- #
# Confidence — a product of independent [0,1] data-quality scores. Multiplicative
# so ANY weak factor (thin history, flat market, stale data) collapses the whole
# thing, which is exactly the conservative bias we want (CLAUDE.md §10).
# --------------------------------------------------------------------------- #

def _history_score(days: int) -> float:
    if days < CycleConfig.MIN_HISTORY_DAYS:
        return 0.0
    return min(1.0, days / CycleConfig.HISTORY_FULL_DAYS)


def _amplitude_score(amplitude: float) -> float:
    if amplitude < CycleConfig.MIN_CYCLE_AMPLITUDE_CENTS:
        return 0.0
    return min(1.0, amplitude / CycleConfig.AMPLITUDE_FULL_CENTS)


def _freshness_score(stale_days: int) -> float:
    if stale_days > CycleConfig.MAX_STALE_DAYS:
        return 0.0
    return 1.0 - stale_days / (CycleConfig.MAX_STALE_DAYS + 1)


# --------------------------------------------------------------------------- #
# Basis — always states the real numbers behind the verdict. This IS the trust
# layer; it must never read as opinion ("we think…") and never omit the figures.
# --------------------------------------------------------------------------- #

def _trend_phrase(trend: float, rising: int, falling: int) -> str:
    if rising >= 2:
        return f"risen {rising} days running"
    if falling >= 2:
        return f"fallen {falling} days running"
    if trend > 0:
        return f"risen {abs(trend):.1f}c/L this week"
    if trend < 0:
        return f"fallen {abs(trend):.1f}c/L this week"
    return "been flat this week"


def _build_basis(
    verdict: Verdict,
    *,
    current: float,
    percentile: float,
    window_low: float,
    window_high: float,
    amplitude: float,
    seven: float,
    rising: int,
    falling: int,
    history_days: int,
    stale_days: int,
) -> str:
    win = CycleConfig.PERCENTILE_WINDOW_DAYS
    cheaper_than = round(100 - percentile)
    dearer_than = round(percentile)

    if verdict == "uncertain":
        if history_days < CycleConfig.MIN_HISTORY_DAYS:
            return (
                f"Only {history_days} days of price history so far — not enough to read "
                f"the cycle (need {CycleConfig.MIN_HISTORY_DAYS})."
            )
        if amplitude < CycleConfig.MIN_CYCLE_AMPLITUDE_CENTS:
            return (
                f"Area prices have been flat — just a {amplitude:.1f}c/L range over the "
                f"last {win} days — so there's no cycle to time."
            )
        if stale_days > CycleConfig.MAX_STALE_DAYS:
            return f"The latest price data is {stale_days} days old — too stale to call the cycle."
        return "The recent trend isn't a strong enough signal to time your fill-up."

    if verdict == "fill_now":
        return (
            f"Today's area low ({current:.1f}c/L) is cheaper than {cheaper_than}% of the "
            f"last {win} days, and prices have {_trend_phrase(seven, rising, falling)}."
        )

    if verdict == "wait":
        return (
            f"Today's area low ({current:.1f}c/L) is dearer than {dearer_than}% of the "
            f"last {win} days, but prices have {_trend_phrase(seven, rising, falling)} — "
            f"they may keep dropping."
        )

    # fill_only_needed
    return (
        f"Area prices are mid-cycle — today's low ({current:.1f}c/L) sits in a "
        f"{window_low:.1f}–{window_high:.1f}c/L range over the last {win} days, and has "
        f"{_trend_phrase(seven, rising, falling)}. No strong reason to time it."
    )


# --------------------------------------------------------------------------- #
# The classifier.
# --------------------------------------------------------------------------- #

def _uncertain(
    history_days: int,
    *,
    current: float | None = None,
    percentile: float | None = None,
    window_low: float | None = None,
    window_high: float | None = None,
    amplitude: float | None = None,
    seven: float | None = None,
    fourteen: float | None = None,
    rising: int | None = None,
    falling: int | None = None,
    confidence: float = 0.0,
    stale_days: int = 0,
) -> CycleAssessment:
    basis = _build_basis(
        "uncertain",
        current=current or 0.0, percentile=percentile or 0.0,
        window_low=window_low or 0.0, window_high=window_high or 0.0,
        amplitude=amplitude or 0.0, seven=seven or 0.0,
        rising=rising or 0, falling=falling or 0,
        history_days=history_days, stale_days=stale_days,
    )
    return CycleAssessment(
        verdict="uncertain", confidence=round(confidence, 2),
        seven_day_trend=seven, fourteen_day_trend=fourteen,
        cycle_percentile=percentile,
        days_since_local_minimum=None, days_since_local_maximum=None,
        consecutive_rising_days=rising, consecutive_falling_days=falling,
        current_price=current, window_low=window_low, window_high=window_high,
        amplitude=amplitude, history_days=history_days,
        expected_saving_per_tank=None, basis=basis,
    )


def assess_cycle(
    lows: list[DailyLow], tank_l: float, *, now: date | None = None
) -> CycleAssessment:
    """Classify the current point in the price cycle from the daily area-low series.

    `now` anchors the staleness check; it defaults to the newest day in the series
    (so a dated demo snapshot isn't penalised), and the live caller passes the real
    wall-clock date.
    """
    history_days = len(lows)
    if history_days < CycleConfig.MIN_HISTORY_DAYS:
        # Can't read a ~4-week cycle — be honest rather than guess.
        return _uncertain(history_days)

    series = [r.price for r in lows]
    reference = now or date.fromisoformat(lows[-1].date)
    stale_days = max(0, (reference - date.fromisoformat(lows[-1].date)).days)

    window = series[-CycleConfig.PERCENTILE_WINDOW_DAYS:]
    extrema_window = series[-CycleConfig.EXTREMA_LOOKBACK_DAYS:]
    current = series[-1]
    window_low, window_high = min(window), max(window)
    amplitude = round(window_high - window_low, 1)

    percentile = percentile_rank(window, current)
    seven = trend_over(series, CycleConfig.TREND_SHORT_DAYS)
    fourteen = trend_over(series, CycleConfig.TREND_LONG_DAYS)
    rising, falling = running_streaks(series)
    since_min, since_max = days_since_extrema(extrema_window)

    confidence = round(
        _history_score(history_days)
        * _amplitude_score(amplitude)
        * _freshness_score(stale_days),
        2,
    )

    # Verdict logic — the single source of truth for the timing call (CLAUDE.md §6).
    if confidence < CycleConfig.MIN_CONFIDENCE:
        return _uncertain(
            history_days, current=current, percentile=percentile,
            window_low=window_low, window_high=window_high, amplitude=amplitude,
            seven=seven, fourteen=fourteen, rising=rising, falling=falling,
            confidence=confidence, stale_days=stale_days,
        )

    if percentile < CycleConfig.LOW_PERCENTILE and seven > 0:
        verdict = "fill_now"
    elif percentile > CycleConfig.HIGH_PERCENTILE and seven < 0:
        verdict = "wait"
    else:
        verdict = "fill_only_needed"

    # Only "wait" carries an expected saving — the gap back down to the recent low.
    expected_saving = (
        round((current - window_low) * tank_l / 100.0, 2) if verdict == "wait" else None
    )

    basis = _build_basis(
        verdict, current=current, percentile=percentile,
        window_low=window_low, window_high=window_high, amplitude=amplitude,
        seven=seven, rising=rising, falling=falling,
        history_days=history_days, stale_days=stale_days,
    )

    return CycleAssessment(
        verdict=verdict, confidence=confidence,
        seven_day_trend=seven, fourteen_day_trend=fourteen,
        cycle_percentile=percentile,
        days_since_local_minimum=since_min, days_since_local_maximum=since_max,
        consecutive_rising_days=rising, consecutive_falling_days=falling,
        current_price=round(current, 1), window_low=round(window_low, 1),
        window_high=round(window_high, 1), amplitude=amplitude,
        history_days=history_days, expected_saving_per_tank=expected_saving,
        basis=basis,
    )
