from app.engine.cycle import assess_cycle
from app.models import DailyLow


def _lows(prices: list[float]) -> list[DailyLow]:
    return [
        DailyLow(date=f"2026-05-{i + 1:02d}", fuel_type="E10", area="Sydney", price=p)
        for i, p in enumerate(prices)
    ]


def test_insufficient_history_falls_back_to_cheapest_now():
    a = assess_cycle(_lows([180, 181, 182, 179, 180]), tank_l=55)
    assert a.verdict == "cheapest_now"
    assert a.confidence == "low"


def test_flat_market_is_low_confidence():
    a = assess_cycle(_lows([180, 181, 182, 180, 181, 182, 180, 181, 182, 181]), tank_l=55)
    assert a.verdict == "cheapest_now"
    assert a.confidence == "low"


def test_near_trough_says_fill_now():
    a = assess_cycle(_lows([180, 182, 184, 186, 188, 190, 192, 194, 170, 172]), tank_l=55)
    assert a.verdict == "fill_now"
    assert a.phase == "near_trough"


def test_near_peak_says_wait_with_expected_saving():
    a = assess_cycle(_lows([170, 172, 174, 176, 178, 180, 182, 184, 186, 189]), tank_l=55)
    assert a.verdict == "wait"
    assert a.phase == "near_peak"
    # (189 - 170) * 55 / 100 = 10.45
    assert a.expected_saving_per_tank == 10.45
    assert a.wait_days is not None


def test_rising_midcycle_says_fill_now():
    a = assess_cycle(_lows([180, 185, 190, 170, 172, 174, 176, 178, 180, 182]), tank_l=55)
    assert a.verdict == "fill_now"
    assert a.phase == "rising"
    assert 0.25 < a.position_in_range < 0.8
