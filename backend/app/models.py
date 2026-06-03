"""Core domain models.

These mirror the FuelCheck response shape but are owned by us, so the rest of
the app never depends on FuelCheck's wire format. The most load-bearing detail:
each `Price` carries its OWN `last_updated` (operator-submitted), which is the
basis for per-price freshness (CLAUDE.md §4) — not our poll time.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from enum import Enum

from pydantic import BaseModel, Field


class FuelType(str, Enum):
    """Closed list of fuel codes the product supports (CLAUDE.md §7).

    Fuel type is safety-relevant — showing E10 advice to a 95-only car is wrong —
    so the user-facing set is a known, closed list. `Price.fuel_type` stays a plain
    string to tolerate any extra codes the live API emits without crashing.
    """

    E10 = "E10"
    U91 = "U91"
    P95 = "P95"
    P98 = "P98"
    DL = "DL"
    PDL = "PDL"
    LPG = "LPG"
    EV = "EV"


FUEL_TYPE_LABELS: dict[str, str] = {
    "E10": "E10 (94)",
    "U91": "Unleaded 91",
    "P95": "Premium 95",
    "P98": "Premium 98",
    "DL": "Diesel",
    "PDL": "Premium Diesel",
    "LPG": "LPG",
    "EV": "EV charging",
}


class Freshness(str, Enum):
    FRESH = "fresh"      # < 24h old
    AGEING = "ageing"    # 24–48h old
    STALE = "stale"      # > 48h old


# Stale thresholds, chosen explicitly (CLAUDE.md §4).
FRESH_MAX = timedelta(hours=24)
AGEING_MAX = timedelta(hours=48)


def classify_freshness(last_updated: datetime, reference: datetime) -> Freshness:
    """Classify a price by the age of ITS OWN last_updated relative to a
    reference 'now'. For a dated snapshot the reference is the snapshot's
    captured_at (so demo data isn't all flagged stale); for live data it's the
    wall clock."""
    age = reference - last_updated
    if age < FRESH_MAX:
        return Freshness.FRESH
    if age < AGEING_MAX:
        return Freshness.AGEING
    return Freshness.STALE


class Location(BaseModel):
    latitude: float
    longitude: float


class Station(BaseModel):
    code: str
    name: str
    brand: str | None = None
    address: str | None = None
    location: Location


class Price(BaseModel):
    station_code: str
    fuel_type: str
    price: float = Field(description="Price in cents per litre, e.g. 189.9")
    last_updated: datetime


class Snapshot(BaseModel):
    """A point-in-time pull of all stations + prices.

    `captured_at` is when WE fetched it (poll time / snapshot date). Freshness is
    computed per-price against this reference, never from captured_at alone.
    """

    captured_at: datetime
    stations: list[Station]
    prices: list[Price]


class DailyLow(BaseModel):
    """One day's lowest observed price for a fuel type in an area — the unit the
    price-cycle heuristic reasons over (CLAUDE.md §10)."""

    date: str          # ISO date, YYYY-MM-DD
    fuel_type: str
    area: str
    price: float
