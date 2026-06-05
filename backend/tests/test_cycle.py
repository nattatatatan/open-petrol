"""Unit tests for the deterministic price-cycle classifier (CLAUDE.md §6).

Each verdict and each signal is exercised against a FIXED, hand-built series (a
realistic sawtooth, never random noise) so the expected output is knowable by hand —
the whole point of a deterministic, no-ML classifier.
"""

from datetime import date, timedelta

import pytest

from app.engine.cycle import (
    CycleConfig,
    assess_cycle,
    days_since_extrema,
    percentile_rank,
    running_streaks,
    trend_over,
)
from app.models import DailyLow


def _lows(prices: list[float], start: str = "2026-05-01") -> list[DailyLow]:
    d0 = date.fromisoformat(start)
    return [
        DailyLow(
            date=(d0 + timedelta(days=i)).isoformat(),
            fuel_type="E10",
            area="Sydney",
            price=p,
        )
        for i, p in enumerate(prices)
    ]


# --------------------------------------------------------------------------- #
# Signals (each a pure function).
# --------------------------------------------------------------------------- #

def test_percentile_rank_counts_days_strictly_below():
    assert percentile_rank([170, 180, 190, 200], 190) == 50.0
    assert percentile_rank([170, 180, 190, 200], 170) == 0.0     # cheapest
    assert percentile_rank([170, 180, 190, 200], 200) == 75.0    # dearest of 4


def test_trend_over_is_signed_change_across_window():
    assert trend_over([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 7) == 7   # 10 - 3
    assert trend_over([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 7) == -7
    # Shorter than the window: change across the whole series.
    assert trend_over([5, 7], 7) == 2


def test_running_streaks_counts_back_from_today():
    assert running_streaks([1, 2, 3, 4]) == (3, 0)              # 3 rises
    assert running_streaks([3, 2, 4, 5, 6]) == (3, 0)
    assert running_streaks([1, 2, 3, 2]) == (0, 1)              # last step fell
    assert running_streaks([5, 4, 3, 2]) == (0, 3)


def test_days_since_extrema_uses_most_recent_extremum():
    # min 160 at idx4, max 180 at idx2; last idx is 5.
    assert days_since_extrema([170, 165, 180, 175, 160, 170]) == (1, 3)


# --------------------------------------------------------------------------- #
# Verdict: uncertain — the three honest fallbacks (CLAUDE.md §10).
# --------------------------------------------------------------------------- #

def test_insufficient_history_is_uncertain():
    a = assess_cycle(_lows([180, 181, 182, 179, 180, 181]), tank_l=55)
    assert a.verdict == "uncertain"
    assert a.confidence == 0.0
    assert "history" in a.basis.lower()
    assert a.history_days == 6


def test_flat_market_is_uncertain():
    # 25 days but a tiny range (< MIN_CYCLE_AMPLITUDE_CENTS) — no cycle to time.
    series = [180.0, 181.0, 180.0, 181.5, 180.5] * 5
    a = assess_cycle(_lows(series), tank_l=55)
    assert a.verdict == "uncertain"
    assert a.confidence == 0.0
    assert "flat" in a.basis.lower()


def test_stale_data_is_uncertain():
    # Healthy sawtooth, but the newest point is well past MAX_STALE_DAYS old.
    rise = [168.0 + i for i in range(30)]
    lows = _lows(rise, start="2026-05-01")
    last = date.fromisoformat(lows[-1].date)
    a = assess_cycle(lows, tank_l=55, now=last + timedelta(days=10))
    assert a.verdict == "uncertain"
    assert a.confidence == 0.0
    assert "old" in a.basis.lower()


# --------------------------------------------------------------------------- #
# Verdict: fill_now — cheap (percentile < 25) AND rising (7-day trend > 0).
# --------------------------------------------------------------------------- #

FILL_NOW_SERIES = (
    [176.0 + i for i in range(22)]            # tail of a long climb 176..197
    + [168.0]                                 # sharp drop to the trough
    + [169.0, 170.0, 171.0, 172.0, 173.0, 174.0, 175.0]  # 7 days rising from trough
)


def test_fill_now_when_cheap_and_rising():
    a = assess_cycle(_lows(FILL_NOW_SERIES), tank_l=55)
    assert a.verdict == "fill_now"
    assert a.confidence >= CycleConfig.MIN_CONFIDENCE
    assert a.cycle_percentile < CycleConfig.LOW_PERCENTILE
    assert a.seven_day_trend > 0
    assert a.consecutive_rising_days == 7
    assert "cheaper than" in a.basis and "running" in a.basis


# --------------------------------------------------------------------------- #
# Verdict: wait — expensive (percentile > 75) AND falling (7-day trend < 0).
# A low base, a hump that peaked ~a week ago, now easing back but still high.
# --------------------------------------------------------------------------- #

WAIT_SERIES = (
    [168.0 + 0.5 * i for i in range(22)]      # 22 low days 168.0..178.5
    + [190.0, 192.0, 191.0, 189.0, 187.0, 184.0]  # hump (day 23 = 190, 7 back from today)
    + [181.0, 182.0]                          # easing back; today = 182.0
)


def test_wait_when_expensive_and_falling():
    a = assess_cycle(_lows(WAIT_SERIES), tank_l=55)
    assert a.verdict == "wait"
    assert a.confidence >= CycleConfig.MIN_CONFIDENCE
    assert a.cycle_percentile > CycleConfig.HIGH_PERCENTILE
    assert a.seven_day_trend < 0
    # expected saving = (current - window_low) * tank / 100 = (182 - 168) * 55 / 100
    assert a.expected_saving_per_tank == pytest.approx(7.70)
    assert "dearer than" in a.basis and "fallen" in a.basis


# --------------------------------------------------------------------------- #
# Verdict: fill_only_needed — confident, but neither trigger fires (mid-cycle).
# Here: near the trough but still falling, so no rush either way.
# --------------------------------------------------------------------------- #

ONLY_NEEDED_SERIES = (
    [168.0 + i for i in range(23)]            # climb 168..190
    + [187.0, 184.0, 181.0, 178.0, 176.0, 174.0, 172.0]  # 7 days falling; today = 172
)


def test_fill_only_needed_when_confident_but_no_trigger():
    a = assess_cycle(_lows(ONLY_NEEDED_SERIES), tank_l=55)
    assert a.verdict == "fill_only_needed"
    assert a.confidence >= CycleConfig.MIN_CONFIDENCE
    # cheap-ish but FALLING (not rising) -> not fill_now; not expensive -> not wait.
    assert a.seven_day_trend < 0
    assert a.expected_saving_per_tank is None
    assert "mid-cycle" in a.basis


# --------------------------------------------------------------------------- #
# Boundary cases at the percentile / trend thresholds.
# --------------------------------------------------------------------------- #

def test_low_percentile_but_not_rising_is_not_fill_now():
    # Cheap (percentile < 25) but the 7-day trend is exactly flat -> falls through
    # to fill_only_needed, because fill_now strictly requires trend > 0.
    flat_then_cheap = [196.0 - i for i in range(22)] + [172.0] * 8
    a = assess_cycle(_lows(flat_then_cheap), tank_l=55)
    assert a.cycle_percentile < CycleConfig.LOW_PERCENTILE
    assert a.seven_day_trend == 0
    assert a.verdict == "fill_only_needed"


def test_confidence_just_below_threshold_is_uncertain():
    # 21 days (history score 0.7) and amplitude exactly 8c (amplitude score 0.5):
    # 0.7 * 0.5 = 0.35 < MIN_CONFIDENCE -> uncertain even though history is "enough".
    series = []
    for i in range(21):
        series.append(168.0 if i % 2 == 0 else 176.0)  # range exactly 8c
    a = assess_cycle(_lows(series), tank_l=55)
    assert a.history_days == 21
    assert a.amplitude == 8.0
    assert a.confidence < CycleConfig.MIN_CONFIDENCE
    assert a.verdict == "uncertain"
