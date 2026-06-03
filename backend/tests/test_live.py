"""Live-source parsing (no network). The demo runs on snapshots, but freshness on
the live path is trust-critical, so the timezone handling is unit-tested."""

from datetime import datetime, timezone

from app.sources.live import LiveFuelCheckSource


def test_lastupdated_parsed_as_nsw_local_then_utc():
    # FuelCheck reports NSW local time. June -> AEST (UTC+10), so 14:30 local is
    # 04:30 UTC. Stamping the naive value as UTC (the old bug) would have left it at
    # 14:30Z — ~10h in the future vs a UTC "now", mis-classifying stale as fresh.
    parsed = LiveFuelCheckSource._parse_lastupdated("01/06/2026 14:30:00")
    assert parsed == datetime(2026, 6, 1, 4, 30, tzinfo=timezone.utc)


def test_lastupdated_handles_daylight_saving():
    # January -> AEDT (UTC+11), so 14:30 local is 03:30 UTC.
    parsed = LiveFuelCheckSource._parse_lastupdated("15/01/2026 14:30:00")
    assert parsed == datetime(2026, 1, 15, 3, 30, tzinfo=timezone.utc)
