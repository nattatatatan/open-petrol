from app.history.datansw import PriceEvent, daily_lows_from_events


def test_daily_lows_takes_min_per_day_and_fuel():
    events = [
        PriceEvent("2026-06-01", "E10", 185.0),
        PriceEvent("2026-06-01", "E10", 179.9),  # lower same-day -> wins
        PriceEvent("2026-06-01", "U91", 188.0),
        PriceEvent("2026-06-02", "E10", 176.0),
    ]
    rows = daily_lows_from_events(events, area="Sydney")
    by_key = {(r.date, r.fuel_type): r.price for r in rows}
    assert by_key[("2026-06-01", "E10")] == 179.9
    assert by_key[("2026-06-01", "U91")] == 188.0
    assert by_key[("2026-06-02", "E10")] == 176.0
    assert all(r.area == "Sydney" for r in rows)
