"""SnapshotSource — reads a dated, captured dataset from disk.

THE DEMO RUNS ON THIS (CLAUDE.md §3): no network, no rate limits, no flaky
requests. It is byte-compatible with what `LiveFuelCheckSource` produces, so the
engine cannot tell them apart.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.models import DailyLow, Snapshot
from app.sources.base import FuelSource


class SnapshotSource(FuelSource):
    name = "snapshot"

    def __init__(self, snapshot_path: Path, history_path: Path) -> None:
        self._snapshot_path = snapshot_path
        self._history_path = history_path

    async def get_current_prices(self) -> Snapshot:
        with open(self._snapshot_path, encoding="utf-8") as fh:
            return Snapshot.model_validate(json.load(fh))

    async def get_historical_lows(
        self, fuel_type: str, area: str, days: int
    ) -> list[DailyLow]:
        if not self._history_path.exists():
            return []
        with open(self._history_path, encoding="utf-8") as fh:
            rows = [DailyLow.model_validate(r) for r in json.load(fh)]
        rows = [
            r
            for r in rows
            if r.fuel_type == fuel_type and r.area.lower() == area.lower()
        ]
        rows.sort(key=lambda r: r.date)
        return rows[-days:]
