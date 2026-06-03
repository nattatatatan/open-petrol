from app.advisor.service import AdvisorService, build_deterministic
from app.config import get_settings
from app.cache.store import PriceCache
from app.engine.cycle import assess_cycle
from app.models import DailyLow
from app.sources.snapshot import SnapshotSource


def _lows(prices):
    return [
        DailyLow(date=f"2026-05-{i + 1:02d}", fuel_type="E10", area="Sydney", price=p)
        for i, p in enumerate(prices)
    ]


def test_deterministic_wait_phrasing_mentions_saving():
    cycle = assess_cycle(_lows([170, 172, 174, 176, 178, 180, 182, 184, 186, 189]), tank_l=55)
    res = build_deterministic(cycle, fuel="E10", tank=55, rec=None)
    assert res.verdict == "wait"
    assert res.source == "deterministic"
    assert "$" in res.detail and res.basis


async def test_service_advise_runs_keyless_on_snapshot(tmp_path):
    settings = get_settings()  # no ANTHROPIC_API_KEY in test env -> deterministic
    source = SnapshotSource(settings.snapshot_path, settings.history_path)
    svc = AdvisorService(settings, PriceCache(tmp_path / "c.db"), source)

    res = await svc.advise(fuel="E10", area="Sydney", tank=55)
    assert res.source == "deterministic"
    assert res.verdict in {"fill_now", "wait", "cheapest_now"}
    assert res.headline and res.basis
