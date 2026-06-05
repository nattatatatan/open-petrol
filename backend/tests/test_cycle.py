"""Unit tests for the deterministic price-cycle classifier (CLAUDE.md §6).

Each verdict, phase, and signal is exercised against a FIXED, hand-built series (a
realistic sawtooth, never random noise) so the expected output is knowable by hand —
the whole point of a deterministic, no-ML classifier.
"""

from datetime import date, timedelta

import pytest

from app.engine.cycle import (
    CycleConfig,
    assess_cycle,
    classify_phase,
    days_since_extrema,
    percentile_rank,
    robust_zscore,
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


def test_robust_zscore_flags_an_outlier_not_a_legit_extremum():
    history = [170, 172, 168, 171, 169, 173, 167, 170, 172, 168]
    # A normal-ish high reads as a small z; a wild value reads as a huge one.
    assert robust_zscore(history, 175) < 3.0
    assert robust_zscore(history, 400) > CycleConfig.ANOMALY_Z_SCORE
    assert robust_zscore([170, 170, 170], 170) == 0.0          # no spread => 0


# --------------------------------------------------------------------------- #
# Phase classifier (pure) — the turning points are detected asymmetrically.
# --------------------------------------------------------------------------- #

def test_phase_peak_needs_the_downturn_confirmed():
    # At a fresh high (since_max=0) but still rising (micro>0) is NOT yet a peak.
    assert classify_phase(micro=2, seven=8, rising=3, falling=0,
                          since_min=20, since_max=0) == "rising"
    # Same high, now rolling over (micro<0) -> peak.
    assert classify_phase(micro=-3, seven=5, rising=0, falling=1,
                          since_min=20, since_max=1) == "peak"


def test_phase_trough_fires_on_price_alone_when_turning_up():
    assert classify_phase(micro=1, seven=-2, rising=1, falling=0,
                          since_min=1, since_max=20) == "trough"


# --------------------------------------------------------------------------- #
# Verdict: uncertain — the honest fallbacks (CLAUDE.md §10).
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


# P0 fix: a clean, fresh, ample series that is simply mid-cycle and barely moving must
# be UNCERTAIN — the old (data-quality-only) confidence shipped this at 1.0.
WEAK_SIGNAL_SERIES = (
    [168, 170, 172, 174, 176, 178, 180, 182, 184, 186, 188, 190, 192, 194, 195]
    + [182] * 15  # today = 182, flat for a fortnight: no 3/7/14-day movement
)


def test_clean_but_weak_signal_is_uncertain_not_overconfident():
    a = assess_cycle(_lows(WEAK_SIGNAL_SERIES), tank_l=55)
    assert a.history_days == 30           # plenty of history
    assert a.amplitude >= CycleConfig.MIN_CYCLE_AMPLITUDE_CENTS  # real cycle amplitude
    assert 0.0 < a.confidence < CycleConfig.MIN_CONFIDENCE       # data fine, signal weak
    assert a.verdict == "uncertain"
    assert "barely moved" in a.basis.lower()


def test_anomalous_latest_price_is_uncertain():
    # A healthy ramp, then a garbage final reading (parse error / stuck price).
    a = assess_cycle(_lows([168.0 + i for i in range(25)] + [400.0]), tank_l=55)
    assert a.verdict == "uncertain"
    assert a.confidence == 0.0
    assert "data looks off" in a.basis.lower()


# --------------------------------------------------------------------------- #
# Verdict: fill_now — at the trough, OR cheap-and-rising (uses the extrema +
# slope signals, not just a percentile gate).
# --------------------------------------------------------------------------- #

TROUGH_SERIES = (
    [170, 173, 176, 179, 182, 185, 188, 191, 194, 197, 199]  # climb to a high
    + [195, 191, 187, 183, 179, 175, 171, 167]               # sharp drop to the trough (167)
    + [168, 170, 171]                                         # turning up; today = 171
)


def test_fill_now_at_the_trough():
    a = assess_cycle(_lows(TROUGH_SERIES), tank_l=55)
    assert a.phase == "trough"
    assert a.verdict == "fill_now"
    assert a.confidence >= CycleConfig.MIN_CONFIDENCE
    assert a.days_since_local_minimum <= CycleConfig.EXTREMA_RECENT_DAYS
    assert a.cycle_percentile < 25
    assert a.expected_saving_per_tank is None
    assert "cheapest" in a.basis.lower()


# Mid-range (percentile between 25 and 50) but clearly climbing out of a recent trough:
# the OLD percentile<25 gate would miss this; the phase model calls it correctly.
RISING_MID_SERIES = (
    [188, 190, 189, 191, 190, 192, 190, 191, 189, 190,
     188, 190, 189, 191, 190, 192, 190, 191, 189]            # 19 high days
    + [185, 180, 175, 170, 168]                              # drop to the trough (168)
    + [170, 172, 174, 176, 178, 180]                         # 6 rising days; today = 180
)


def test_fill_now_when_cheap_and_rising_above_the_old_gate():
    a = assess_cycle(_lows(RISING_MID_SERIES), tank_l=55)
    assert a.phase == "rising"
    assert a.verdict == "fill_now"
    assert 25 < a.cycle_percentile < 50          # beyond the old "cheap" gate
    assert a.seven_day_trend > 0
    assert a.confidence >= CycleConfig.MIN_CONFIDENCE
    assert "climbing" in a.basis.lower()


# --------------------------------------------------------------------------- #
# Verdict: wait — at the peak (fresh high, turning down), OR dear-and-falling.
# --------------------------------------------------------------------------- #

PEAK_SERIES = (
    [168.0 + 0.5 * i for i in range(18)]   # 18 low days 168.0..176.5
    + [182, 188, 194, 198]                 # sharp climb to the peak (198)
    + [196, 193, 190]                      # rolling over; today = 190
)


def test_wait_at_the_peak():
    a = assess_cycle(_lows(PEAK_SERIES), tank_l=55)
    assert a.phase == "peak"
    assert a.verdict == "wait"
    assert a.days_since_local_maximum <= CycleConfig.EXTREMA_RECENT_DAYS
    assert a.three_day_trend < 0           # the micro-slope is what catches the turn
    assert a.cycle_percentile > 75
    # expected saving = (current - window_low) * tank / 100 = (190 - 168) * 55 / 100
    assert a.expected_saving_per_tank == pytest.approx(12.10)
    assert "turned down" in a.basis.lower()


WAIT_FALLING_SERIES = (
    [168.0 + 0.5 * i for i in range(12)]   # 12 low days
    + [178, 184, 190, 196]                 # climb to the peak (196)
    + [193, 190, 187, 184, 182, 180]       # well into the fall; today = 180
)


def test_wait_when_dear_and_falling_past_the_peak():
    a = assess_cycle(_lows(WAIT_FALLING_SERIES), tank_l=55)
    assert a.phase == "falling"
    assert a.verdict == "wait"
    assert a.days_since_local_maximum > CycleConfig.EXTREMA_RECENT_DAYS  # not a fresh peak
    assert a.seven_day_trend < 0
    assert a.cycle_percentile >= CycleConfig.MID_PERCENTILE
    assert a.expected_saving_per_tank == pytest.approx(6.60)  # (180 - 168) * 55 / 100
    assert "keep dropping" in a.basis.lower()


# --------------------------------------------------------------------------- #
# Verdict: fill_only_needed — confident, but no actionable timing edge.
# --------------------------------------------------------------------------- #

def test_fill_only_needed_when_rising_but_already_dear():
    # A long, steady climb: today is dear and still rising — past the cheap window, but
    # no reason to wait (prices going up). Confident (the position signal is strong).
    a = assess_cycle(_lows([168.0 + i for i in range(30)]), tank_l=55)
    assert a.phase == "rising"
    assert a.verdict == "fill_only_needed"
    assert a.cycle_percentile > CycleConfig.MID_PERCENTILE
    assert a.confidence >= CycleConfig.MIN_CONFIDENCE
    assert a.expected_saving_per_tank is None
    assert "still rising" in a.basis.lower()


# --------------------------------------------------------------------------- #
# Every computed signal is load-bearing (regression guard against "decorative
# signals" — the audit finding the redesign fixed).
# --------------------------------------------------------------------------- #

def test_all_slopes_and_extrema_are_populated_on_a_real_call():
    a = assess_cycle(_lows(RISING_MID_SERIES), tank_l=55)
    for field in (
        a.three_day_trend, a.seven_day_trend, a.fourteen_day_trend,
        a.cycle_percentile, a.days_since_local_minimum, a.days_since_local_maximum,
    ):
        assert field is not None
