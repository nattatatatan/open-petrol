"""Source factory — the one place the data adapter is chosen.

Flipping `SOURCE=snapshot|live` here is the entire cost of swapping data sources
(CLAUDE.md §3). Nothing downstream changes.
"""

from __future__ import annotations

from app.config import Settings
from app.sources.base import FuelSource
from app.sources.live import HistoryProvider, LiveFuelCheckSource
from app.sources.snapshot import SnapshotSource


def build_source(
    settings: Settings, history_provider: HistoryProvider | None = None
) -> FuelSource:
    if settings.source == "live":
        return LiveFuelCheckSource(
            api_key=settings.fuelcheck_api_key,
            api_secret=settings.fuelcheck_api_secret,
            base_url=settings.fuelcheck_base_url,
            history_provider=history_provider,
        )
    return SnapshotSource(
        snapshot_path=settings.snapshot_path,
        history_path=settings.history_path,
    )
