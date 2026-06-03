from datetime import datetime, timedelta, timezone

from app.models import Freshness, classify_freshness


REF = datetime(2026, 6, 2, 12, 0, tzinfo=timezone.utc)


def test_freshness_fresh_under_24h():
    assert classify_freshness(REF - timedelta(hours=1), REF) is Freshness.FRESH
    assert classify_freshness(REF - timedelta(hours=23, minutes=59), REF) is Freshness.FRESH


def test_freshness_ageing_24_to_48h():
    assert classify_freshness(REF - timedelta(hours=24), REF) is Freshness.AGEING
    assert classify_freshness(REF - timedelta(hours=47), REF) is Freshness.AGEING


def test_freshness_stale_over_48h():
    assert classify_freshness(REF - timedelta(hours=48), REF) is Freshness.STALE
    assert classify_freshness(REF - timedelta(days=5), REF) is Freshness.STALE
