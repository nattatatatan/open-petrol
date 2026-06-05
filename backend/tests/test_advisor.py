from datetime import date, timedelta

from app.advisor.service import AdvisorService, build_deterministic
from app.config import get_settings
from app.cache.store import PriceCache
from app.engine.cycle import assess_cycle
from app.models import DailyLow
from app.sources.snapshot import SnapshotSource


def _lows(prices, start="2026-05-01"):
    d0 = date.fromisoformat(start)
    return [
        DailyLow(date=(d0 + timedelta(days=i)).isoformat(), fuel_type="E10",
                 area="Sydney", price=p)
        for i, p in enumerate(prices)
    ]


# Same hand-built "wait" sawtooth as test_cycle: expensive + falling.
WAIT_SERIES = (
    [168.0 + 0.5 * i for i in range(22)]
    + [190.0, 192.0, 191.0, 189.0, 187.0, 184.0]
    + [181.0, 182.0]
)


def test_deterministic_copy_is_keyed_off_the_verdict():
    cycle = assess_cycle(_lows(WAIT_SERIES), tank_l=55)
    res = build_deterministic(
        cycle, fuel="E10", tank=55, rec={"name": "Costco Auburn", "price": 182.0}
    )
    assert res.verdict == "wait"
    assert res.expected_saving_per_tank == cycle.expected_saving_per_tank
    # Presentation layer quotes the station and passes the classifier's basis through.
    assert "Costco Auburn" in res.detail
    assert res.basis == cycle.basis
    assert "$" in res.detail  # mentions the potential saving


def test_uncertain_verdict_degrades_gracefully():
    cycle = assess_cycle(_lows([180, 181, 182, 179, 180]), tank_l=55)  # too little history
    res = build_deterministic(cycle, fuel="E10", tank=55, rec=None)
    assert res.verdict == "uncertain"
    assert res.confidence == 0.0
    assert res.headline and res.basis


async def test_service_advise_is_deterministic_on_snapshot(tmp_path):
    settings = get_settings()
    source = SnapshotSource(settings.snapshot_path, settings.history_path)
    svc = AdvisorService(settings, PriceCache(tmp_path / "c.db"), source)

    res = await svc.advise(fuel="E10", area="Sydney", tank=55)
    assert res.verdict in {"fill_now", "fill_only_needed", "wait", "uncertain"}
    assert res.headline and res.basis
    assert 0.0 <= res.confidence <= 1.0
