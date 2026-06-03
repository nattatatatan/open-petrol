"""The `FuelSource` seam.

The recommendation engine and API talk ONLY to this interface, never to FuelCheck
directly (CLAUDE.md §3). Two implementations sit behind it — `SnapshotSource`
(demo) and `LiveFuelCheckSource` (proves the live path) — and swapping them is a
one-line config change.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.models import DailyLow, Snapshot


class FuelSource(ABC):
    """Where fuel data originates. Storage/serving is a separate concern (the
    cache); this is purely about producing data."""

    name: str = "abstract"

    @abstractmethod
    async def get_current_prices(self) -> Snapshot:
        """Return a full point-in-time snapshot of all stations + prices."""

    @abstractmethod
    async def get_historical_lows(
        self, fuel_type: str, area: str, days: int
    ) -> list[DailyLow]:
        """Return daily lowest prices for a fuel type in an area over the last
        `days` days — the series the price-cycle heuristic reasons over."""
