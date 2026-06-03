from datetime import datetime, timedelta, timezone

import pytest

from app.cache.store import PriceCache
from app.models import Location, Price, Snapshot, Station
from app.sources.base import FuelSource


def _snapshot(captured_at: datetime, e10_low: float) -> Snapshot:
    return Snapshot(
        captured_at=captured_at,
        stations=[
            Station(code="1", name="A", location=Location(latitude=-33.8, longitude=151.2)),
            Station(code="2", name="B", location=Location(latitude=-33.9, longitude=151.1)),
        ],
        prices=[
            Price(station_code="1", fuel_type="E10", price=e10_low, last_updated=captured_at),
            Price(station_code="2", fuel_type="E10", price=e10_low + 5, last_updated=captured_at),
        ],
    )


class FakeSource(FuelSource):
    name = "fake"

    def __init__(self, snapshot: Snapshot | None, fail: bool = False):
        self._snapshot = snapshot
        self._fail = fail

    async def get_current_prices(self) -> Snapshot:
        if self._fail:
            raise RuntimeError("simulated upstream outage")
        return self._snapshot

    async def get_historical_lows(self, fuel_type, area, days):
        return []


@pytest.fixture
def cache(tmp_path):
    return PriceCache(tmp_path / "cache.db")


async def test_refresh_stores_snapshot_and_accumulates_lows(cache):
    snap = _snapshot(datetime(2026, 6, 2, tzinfo=timezone.utc), e10_low=180.0)
    assert await cache.refresh(FakeSource(snap)) is True

    stored = cache.get_snapshot()
    assert stored is not None and len(stored.prices) == 2

    lows = cache.get_history("E10", "Sydney", 30)
    assert len(lows) == 1
    assert lows[0].price == 180.0  # the area-wide low, not the higher price


async def test_graceful_degradation_keeps_last_good(cache):
    good = _snapshot(datetime(2026, 6, 2, tzinfo=timezone.utc), e10_low=180.0)
    await cache.refresh(FakeSource(good))

    # Next refresh fails — we must keep serving the last-good snapshot.
    assert await cache.refresh(FakeSource(None, fail=True)) is False

    stored = cache.get_snapshot()
    assert stored is not None and stored.prices[0].price == 180.0

    status = cache.status()
    assert status.stale_refresh is True
    assert status.last_error is not None and "outage" in status.last_error


async def test_history_accumulates_running_min_across_days(cache):
    d1 = datetime(2026, 6, 1, tzinfo=timezone.utc)
    d2 = datetime(2026, 6, 2, tzinfo=timezone.utc)
    await cache.refresh(FakeSource(_snapshot(d1, e10_low=175.0)))
    await cache.refresh(FakeSource(_snapshot(d2, e10_low=170.0)))
    # A later same-day poll with a higher low must NOT raise the recorded low.
    await cache.refresh(FakeSource(_snapshot(d2, e10_low=172.0)))

    lows = cache.get_history("E10", "Sydney", 30)
    assert [r.price for r in lows] == [175.0, 170.0]
