"""Membership / loyalty effective pricing (CLAUDE.md §7, RESEARCH.md thread A).

FuelCheck publishes PUMP prices, but a 4–5c/L member or docket discount can exceed
the gap between our top stations — so the pump-cheapest can be the WRONG winner for
someone with a card. The user names their cards (multi-select), optionally edits the
rate, or adds a custom "−Xc at [brand]" rule; we subtract the SINGLE BEST applicable
discount per station (no stacking) to get an effective price and rank on that.

Key rationale (a good walkthrough line): there is no API for which cards a user holds,
their active dockets, or the rates — that data is inherently private. So user input was
always required, and making the rate editable is a tiny extension. Because **the user
owns the number**, we can defer stacking, docket tracking, and eligibility entirely.

Trust guard: presets only map brands a program demonstrably honours (flybuys → Reddy
Express only, not generic Shell) — over-claiming a discount breaks the same trust as a
stale price (§4).
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

from pydantic import BaseModel

from app.models import Station

# Premium fuels, where some programs pay a higher rate (e.g. NRMA 5c vs 4c).
PREMIUM_FUELS = {"P95", "P98"}

_CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "discount_catalog.json"


class DiscountPreset(BaseModel):
    key: str
    label: str
    brands: list[str]
    cents: float                 # default discount, c/L
    premium: float | None = None  # overrides `cents` for PREMIUM_FUELS when set

    def rate_for_fuel(self, fuel_type: str) -> float:
        if self.premium is not None and fuel_type in PREMIUM_FUELS:
            return self.premium
        return self.cents


@lru_cache(maxsize=1)
def load_catalog() -> list[DiscountPreset]:
    """Bundled for the demo; in production this JSON is fetched once on launch from a
    small remote file so base rates update without a new build."""
    data = json.loads(_CATALOG_PATH.read_text())
    return [DiscountPreset(**p) for p in data["presets"]]


def _catalog_by_key() -> dict[str, DiscountPreset]:
    return {p.key: p for p in load_catalog()}


class MembershipSelection(BaseModel):
    """The user's chosen cards + rate overrides + custom brand rules. The user owns
    the numbers, which is what lets us defer stacking & docket tracking."""

    memberships: list[str] = []
    rate_overrides: dict[str, float] = {}        # preset key -> cents (replaces default)
    custom_rules: list[tuple[str, float]] = []   # (brand, cents)

    def is_empty(self) -> bool:
        return not self.memberships and not self.custom_rules


def resolve_discounts(
    stations: list[Station],
    fuel_type: str,
    selection: MembershipSelection,
) -> dict[str, tuple[float, str]]:
    """station_code -> (best cents/L discount, source label).

    NO stacking: each station gets the single best applicable discount across the
    user's selected cards + custom rules."""
    if selection.is_empty():
        return {}

    by_key = _catalog_by_key()
    # brand -> [(cents, label)] from selected presets (with any rate override) + custom.
    brand_offers: dict[str, list[tuple[float, str]]] = {}
    for key in selection.memberships:
        preset = by_key.get(key)
        if preset is None:
            continue
        cents = selection.rate_overrides.get(key, preset.rate_for_fuel(fuel_type))
        if cents <= 0:
            continue
        for brand in preset.brands:
            brand_offers.setdefault(brand, []).append((cents, preset.label))
    for brand, cents in selection.custom_rules:
        if cents > 0 and brand:
            brand_offers.setdefault(brand, []).append((cents, brand))

    out: dict[str, tuple[float, str]] = {}
    for s in stations:
        offers = brand_offers.get(s.brand or "")
        if offers:
            out[s.code] = max(offers, key=lambda x: x[0])  # single best, no stacking
    return out
