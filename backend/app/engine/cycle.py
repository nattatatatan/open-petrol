"""Price-cycle classifier — deterministic, explainable, NOT ML (CLAUDE.md §6, §10).

Timing is a PREDICTION problem, not a language problem, so it is solved with an
explainable rule-based classifier over the cached daily area-low series — never an
LLM and never a learned model. Every number here is computed from the series; the
copy layer (advisor/service.py) only phrases the result and quotes these numbers.

Why deterministic and not ML (the decision this file documents — see
docs/advisor-decision.md): NSW gives ~one supervised example per area per day and the
cycle is ~30–40 days and lengthening, so a model would be fitting a handful of
sawtooth periods — it memorises the recent cycle shape and breaks on the next regime
change, the exact failure §10 warns about. A rule that asks "where am I in the recent
range and which way am I moving" degrades gracefully instead. And the timing call is
NUMERIC, so even with a language entry point an LLM could only re-phrase it. The
`basis` string IS the trust mechanism; a model would replace a quotable causal
sentence with "score 0.62" and need SHAP bolted on to recover what rules give exactly.

Design (revised after the production review, docs/advisor-decision.md):
  * The verdict comes from a 4-PHASE cycle model (trough / rising / peak / falling /
    flat) built from ALL the signals — percentile, the 3/7/14-day slopes, the
    rising/falling streaks, and days-since the 30-day min/max — not just a percentile
    gate. Every computed signal is load-bearing; none is decorative.
  * CONFIDENCE = data-quality × SIGNAL-STRENGTH. The old version multiplied only
    data-quality factors, so a barely-mid-cycle call could ship at confidence 1.0.
    Folding in signal strength means the `< MIN_CONFIDENCE -> uncertain` gate finally
    fires on weak SIGNALS too, not just thin/flat/stale data — the conservative bias
    §6/§10 promised.
  * An anomaly guard (robust MAD z-score) forces `uncertain` when today's low is far
    outside the recent distribution — cheap insurance for the trust thesis against a
    stuck operator price or a parse error driving a verdict.

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
    TREND_MICRO_DAYS = 3            # short slope — detects the turn AT an extremum (peaks are sharp)
    TREND_SHORT_DAYS = 7            # "this week" trend — the main direction signal
    TREND_LONG_DAYS = 14           # fortnight trend — medium-term confirmation
    EXTREMA_LOOKBACK_DAYS = 30      # window for days-since local min/max
    EXTREMA_RECENT_DAYS = 3        # within this many days of an extremum counts as "just" there

    # --- confidence: data-quality inputs (bias LOW) ---
    MIN_HISTORY_DAYS = 21           # below this we can't read a ~4-week cycle at all
    HISTORY_FULL_DAYS = 30          # history score reaches 1.0 here
    MIN_CYCLE_AMPLITUDE_CENTS = 8.0  # a flatter market has no actionable cycle
    AMPLITUDE_FULL_CENTS = 16.0     # amplitude score reaches 1.0 here
    MAX_STALE_DAYS = 3              # newest point older than this => no usable signal

    # --- confidence: signal-strength inputs ---
    TREND_REF_FRACTION = 0.3        # a slope worth 30% of the cycle amplitude => full trend conviction

    # --- anomaly guard ---
    ANOMALY_Z_SCORE = 5.0           # robust(MAD) z above this => data looks wrong => uncertain
                                    # (legit sharp cycle extrema sit around z~3; 5.0 only trips errors)

    # --- verdict thresholds ---
    MIN_CONFIDENCE = 0.6            # below this => "uncertain", never a timing call
    MID_PERCENTILE = 50            # splits rising->fill_now / falling->wait by cheap-vs-dear half
    STREAK_MIN = 2                 # a run of this many days is a direction in its own right


Verdict = str  # "fill_now" | "fill_only_needed" | "wait" | "uncertain"
Phase = str    # "trough" | "rising" | "peak" | "falling" | "flat" | "uncertain"


class CycleAssessment(BaseModel):
    """The full, inspectable output of the classifier: the verdict, the cycle phase it
    came from, the confidence it was reached with, every signal that drove it, and a
    factual human-readable basis."""

    verdict: Verdict
    phase: Phase                          # the cycle phase the verdict was derived from
    confidence: float                     # 0..1, data-quality × signal-strength, biased low

    # signals (all deterministic, from the cached series)
    three_day_trend: float | None         # signed c/L change over TREND_MICRO_DAYS
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


def _median(xs: list[float]) -> float:
    s = sorted(xs)
    n = len(s)
    mid = n // 2
    return s[mid] if n % 2 else (s[mid - 1] + s[mid]) / 2.0


def robust_zscore(history: list[float], value: float) -> float:
    """MAD-based robust z-score of `value` against `history`. Robust to the very
    outlier we want to catch (unlike mean/σ, which the outlier itself inflates).
    Returns 0 when the history has no spread."""
    if not history:
        return 0.0
    med = _median(history)
    mad = _median([abs(x - med) for x in history])
    if mad == 0:
        return 0.0
    return abs(value - med) / (1.4826 * mad)


# --------------------------------------------------------------------------- #
# Phase — a 4-state cycle model (+ flat) that USES every signal. The two
# turning points are detected first because that is where the actionable,
# low-regret calls live; note the deliberate ASYMMETRY (matches the product's
# risk asymmetry, CLAUDE.md §10): a trough fires on price alone (filling cheap is
# low-regret), but a peak needs the down-turn confirmed (a wrong "wait" before a
# hike is the worst outcome).
# --------------------------------------------------------------------------- #

def classify_phase(
    *, micro: float, seven: float, rising: int, falling: int,
    since_min: int, since_max: int,
) -> Phase:
    near_min = since_min <= CycleConfig.EXTREMA_RECENT_DAYS
    near_max = since_max <= CycleConfig.EXTREMA_RECENT_DAYS
    up = seven > 0 or rising >= CycleConfig.STREAK_MIN
    down = seven < 0 or falling >= CycleConfig.STREAK_MIN

    if near_max and micro <= 0:        # at the monthly high and rolling over -> peak
        return "peak"
    if near_min and micro >= 0:        # at the monthly low and turning up -> trough
        return "trough"
    if up and not down:
        return "rising"
    if down and not up:
        return "falling"
    return "flat"


def _phase_to_verdict(phase: Phase, percentile: float) -> Verdict:
    if phase == "trough":
        return "fill_now"
    if phase == "peak":
        return "wait"
    if phase == "rising":
        # Cheap and climbing => lock it in; already dear and climbing => no cheap win left.
        return "fill_now" if percentile <= CycleConfig.MID_PERCENTILE else "fill_only_needed"
    if phase == "falling":
        # Dear and dropping => wait it out; already cheap and easing => no rush either way.
        return "wait" if percentile >= CycleConfig.MID_PERCENTILE else "fill_only_needed"
    return "fill_only_needed"  # flat


# --------------------------------------------------------------------------- #
# Confidence = data-quality × signal-strength. Multiplicative so ANY weak factor
# (thin history, flat market, stale data, OR a weak signal) collapses the whole
# thing to "uncertain" — the conservative bias (CLAUDE.md §6, §10).
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


def _signal_strength(
    *, percentile: float, micro: float, seven: float, fourteen: float, amplitude: float
) -> float:
    """How decisively is THIS a callable moment? The strongest of two convictions:
      - position: how far the price sits from the mid of its range (extremes are clear),
      - movement: the strongest of the 3/7/14-day slopes, scaled to the cycle amplitude
        (a 2c move is the whole story in a 6c market and noise in a 30c one).
    `max` rather than a sum: one strong, unambiguous signal is enough to act on; only
    when BOTH are weak (flat mid-cycle) does conviction — and confidence — collapse."""
    position = min(1.0, abs(percentile - 50.0) / 50.0)
    if amplitude <= 0:
        return position
    strongest_slope = max(abs(micro), abs(seven), abs(fourteen))
    movement = min(1.0, strongest_slope / (amplitude * CycleConfig.TREND_REF_FRACTION))
    return max(position, movement)


# --------------------------------------------------------------------------- #
# Basis — always states the real numbers behind the verdict. This IS the trust
# layer; it must never read as opinion ("we think…") and never omit the figures.
# It is keyed off the PHASE so each call reads truthfully (a rise to the top must
# not be described as "mid-cycle").
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
    phase: Phase,
    verdict: Verdict,
    *,
    current: float,
    percentile: float,
    window_low: float,
    window_high: float,
    amplitude: float,
    micro: float,
    seven: float,
    since_max: int,
    rising: int,
    falling: int,
    history_days: int,
    stale_days: int,
    anomaly: bool = False,
) -> str:
    win = CycleConfig.PERCENTILE_WINDOW_DAYS
    cheaper_than = round(100 - percentile)
    dearer_than = round(percentile)

    if verdict == "uncertain":
        if anomaly:
            return (
                f"Today's area low ({current:.1f}c/L) is far outside the recent range — "
                f"the data looks off, so we're not calling the cycle."
            )
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
        return "Prices have barely moved lately — no strong enough signal to time your fill-up."

    if phase == "trough":
        return (
            f"Today's area low ({current:.1f}c/L) is near the cheapest in the last {win} days "
            f"({window_low:.1f}–{window_high:.1f}c/L) — about as low as this cycle gets."
        )

    if phase == "rising":
        if verdict == "fill_now":
            return (
                f"Today's area low ({current:.1f}c/L) is cheaper than {cheaper_than}% of the "
                f"last {win} days and has {_trend_phrase(seven, rising, falling)} — the cheap "
                f"part of the cycle, and climbing."
            )
        return (
            f"Today's area low ({current:.1f}c/L) is dearer than {dearer_than}% of the last "
            f"{win} days and is still rising — past the cheap part of the cycle."
        )

    if phase == "peak":
        return (
            f"Today's area low ({current:.1f}c/L) is dearer than {dearer_than}% of the last "
            f"{win} days and has turned down ({abs(micro):.1f}c/L over 3 days) from a {win}-day "
            f"high {since_max} day{'s' if since_max != 1 else ''} ago — it may keep falling."
        )

    if phase == "falling":
        if verdict == "wait":
            return (
                f"Today's area low ({current:.1f}c/L) is dearer than {dearer_than}% of the last "
                f"{win} days and has {_trend_phrase(seven, rising, falling)} — likely to keep dropping."
            )
        return (
            f"Today's area low ({current:.1f}c/L) is already cheaper than {cheaper_than}% of the "
            f"last {win} days and easing — no rush either way."
        )

    # flat
    return (
        f"Today's area low ({current:.1f}c/L) sits mid-range ({window_low:.1f}–{window_high:.1f}c/L "
        f"over {win} days) with little movement — no clear timing edge."
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
    micro: float | None = None,
    seven: float | None = None,
    fourteen: float | None = None,
    since_min: int | None = None,
    since_max: int | None = None,
    rising: int | None = None,
    falling: int | None = None,
    confidence: float = 0.0,
    stale_days: int = 0,
    anomaly: bool = False,
) -> CycleAssessment:
    basis = _build_basis(
        "uncertain", "uncertain",
        current=current or 0.0, percentile=percentile or 0.0,
        window_low=window_low or 0.0, window_high=window_high or 0.0,
        amplitude=amplitude or 0.0, micro=micro or 0.0, seven=seven or 0.0,
        since_max=since_max or 0, rising=rising or 0, falling=falling or 0,
        history_days=history_days, stale_days=stale_days, anomaly=anomaly,
    )
    return CycleAssessment(
        verdict="uncertain", phase="uncertain", confidence=round(confidence, 2),
        three_day_trend=micro, seven_day_trend=seven, fourteen_day_trend=fourteen,
        cycle_percentile=percentile,
        days_since_local_minimum=since_min, days_since_local_maximum=since_max,
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

    # Anomaly guard FIRST: if today's low is far outside the recent distribution it is
    # almost certainly bad data (stuck operator price, parse error) — never let it drive
    # a verdict or inflate amplitude/confidence (CLAUDE.md §4, trust).
    if robust_zscore(window[:-1], current) > CycleConfig.ANOMALY_Z_SCORE:
        return _uncertain(
            history_days, current=current, window_low=window_low,
            window_high=window_high, amplitude=amplitude, stale_days=stale_days,
            anomaly=True,
        )

    percentile = percentile_rank(window, current)
    micro = trend_over(series, CycleConfig.TREND_MICRO_DAYS)
    seven = trend_over(series, CycleConfig.TREND_SHORT_DAYS)
    fourteen = trend_over(series, CycleConfig.TREND_LONG_DAYS)
    rising, falling = running_streaks(series)
    since_min, since_max = days_since_extrema(extrema_window)

    # Confidence = data-quality × signal-strength. The signal term is the fix that makes
    # the MIN_CONFIDENCE gate fire on weak SIGNALS, not just weak data.
    data_quality = (
        _history_score(history_days)
        * _amplitude_score(amplitude)
        * _freshness_score(stale_days)
    )
    signal = _signal_strength(
        percentile=percentile, micro=micro, seven=seven, fourteen=fourteen,
        amplitude=amplitude,
    )
    confidence = round(data_quality * signal, 2)

    if confidence < CycleConfig.MIN_CONFIDENCE:
        return _uncertain(
            history_days, current=current, percentile=percentile,
            window_low=window_low, window_high=window_high, amplitude=amplitude,
            micro=micro, seven=seven, fourteen=fourteen,
            since_min=since_min, since_max=since_max, rising=rising, falling=falling,
            confidence=confidence, stale_days=stale_days,
        )

    phase = classify_phase(
        micro=micro, seven=seven, rising=rising, falling=falling,
        since_min=since_min, since_max=since_max,
    )
    verdict = _phase_to_verdict(phase, percentile)

    # Only "wait" carries an expected saving — the gap back down to the recent low.
    expected_saving = (
        round((current - window_low) * tank_l / 100.0, 2) if verdict == "wait" else None
    )

    basis = _build_basis(
        phase, verdict, current=current, percentile=percentile,
        window_low=window_low, window_high=window_high, amplitude=amplitude,
        micro=micro, seven=seven, since_max=since_max,
        rising=rising, falling=falling,
        history_days=history_days, stale_days=stale_days,
    )

    return CycleAssessment(
        verdict=verdict, phase=phase, confidence=confidence,
        three_day_trend=micro, seven_day_trend=seven, fourteen_day_trend=fourteen,
        cycle_percentile=percentile,
        days_since_local_minimum=since_min, days_since_local_maximum=since_max,
        consecutive_rising_days=rising, consecutive_falling_days=falling,
        current_price=round(current, 1), window_low=round(window_low, 1),
        window_high=round(window_high, 1), amplitude=amplitude,
        history_days=history_days, expected_saving_per_tank=expected_saving,
        basis=basis,
    )
