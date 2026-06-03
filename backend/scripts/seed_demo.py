"""Generate a realistic NSW demo dataset for SnapshotSource.

This is a PLACEHOLDER demo seed (real Sydney suburb coordinates + brands, plausible
prices and a real price-cycle sawtooth) so the whole app is runnable before a real
FuelCheck capture exists. Once a FuelCheck key is provided, `capture_snapshot.py`
overwrites current.json with a genuine live pull; the history file remains seeded
from Data.NSW price-history files (CLAUDE.md §10).

Deterministic (fixed seed) so the demo is reproducible.
Prices are in cents per litre, matching FuelCheck.
"""

from __future__ import annotations

import json
import random
from datetime import datetime, timedelta, timezone
from pathlib import Path

random.seed(42)

OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "snapshot"

# Reference "now" for the snapshot. Per-price last_updated is offset back from this.
CAPTURED_AT = datetime(2026, 6, 2, 8, 30, tzinfo=timezone.utc)

# (suburb, lat, lng) — approximate real Sydney-metro centroids.
SUBURBS = [
    ("Parramatta", -33.8150, 151.0011),
    ("Chatswood", -33.7969, 151.1803),
    ("Bondi", -33.8915, 151.2767),
    ("Liverpool", -33.9203, 150.9230),
    ("Penrith", -33.7511, 150.6942),
    ("Hornsby", -33.7027, 151.0993),
    ("Sydney CBD", -33.8688, 151.2093),
    ("Newtown", -33.8978, 151.1793),
    ("Manly", -33.7969, 151.2880),
    ("Cronulla", -34.0577, 151.1543),
    ("Blacktown", -33.7711, 150.9057),
    ("Bankstown", -33.9181, 151.0354),
    ("Ryde", -33.8126, 151.1057),
    ("Hurstville", -33.9675, 151.1027),
    ("Castle Hill", -33.7320, 151.0050),
    ("Campbelltown", -34.0640, 150.8140),
    ("Strathfield", -33.8786, 151.0951),
    ("Randwick", -33.9140, 151.2412),
    ("Dee Why", -33.7510, 151.2980),
    ("Epping", -33.7725, 151.0820),
]

BRANDS = ["7-Eleven", "BP", "Ampol", "Shell", "Metro Petroleum", "United", "Mobil", "Costco"]

# Base price per fuel type (cents/L), roughly NSW mid-2026 levels.
FUEL_BASE = {
    "E10": 184.9,
    "U91": 187.9,
    "P95": 199.9,
    "P98": 209.9,
    "DL": 192.9,
    "PDL": 205.9,
    "LPG": 99.9,
}
# Which fuels each station sells (LPG/PDL not everywhere).
COMMON_FUELS = ["E10", "U91", "P95", "P98", "DL"]


def _jitter(lat: float, lng: float) -> tuple[float, float]:
    return lat + random.uniform(-0.012, 0.012), lng + random.uniform(-0.012, 0.012)


def build_snapshot() -> dict:
    stations = []
    prices = []
    code = 1000

    for suburb, lat, lng in SUBURBS:
        n = random.choice([1, 2, 2])  # 1–2 stations per suburb
        for _ in range(n):
            code += 1
            brand = random.choice(BRANDS)
            slat, slng = _jitter(lat, lng)
            station_code = str(code)
            stations.append(
                {
                    "code": station_code,
                    "name": f"{brand} {suburb}",
                    "brand": brand,
                    "address": f"{random.randint(1, 400)} {suburb} Rd, {suburb} NSW",
                    "location": {"latitude": round(slat, 6), "longitude": round(slng, 6)},
                }
            )

            # Independents/Costco/United tend cheaper; majors pricier.
            if brand in ("Costco", "United", "Metro Petroleum"):
                brand_offset = random.uniform(-7.0, -2.0)
            elif brand in ("BP", "Shell", "Ampol"):
                brand_offset = random.uniform(0.0, 6.0)
            else:
                brand_offset = random.uniform(-3.0, 3.0)

            fuels = list(COMMON_FUELS)
            if random.random() < 0.4:
                fuels.append("LPG")
            if random.random() < 0.3:
                fuels.append("PDL")

            # Each station's prices share a freshness profile: most fresh, some old.
            age_hours = random.choices(
                [random.uniform(0, 20), random.uniform(26, 44), random.uniform(50, 90)],
                weights=[0.7, 0.2, 0.1],
            )[0]
            last_updated = CAPTURED_AT - timedelta(hours=age_hours)

            for fuel in fuels:
                price = FUEL_BASE[fuel] + brand_offset + random.uniform(-2.0, 2.0)
                prices.append(
                    {
                        "station_code": station_code,
                        "fuel_type": fuel,
                        "price": round(price, 1),
                        "last_updated": last_updated.isoformat(),
                    }
                )

    return {
        "captured_at": CAPTURED_AT.isoformat(),
        "stations": stations,
        "prices": prices,
    }


def build_daily_lows(days: int = 42) -> list[dict]:
    """A realistic Sydney sawtooth: gradual rise over ~4 weeks then a sharp drop.
    Generated for E10 and U91 in the 'Sydney' area for the advisor demo."""
    rows = []
    start = CAPTURED_AT.date() - timedelta(days=days - 1)
    for fuel, trough, peak in [("E10", 168.0, 196.0), ("U91", 171.0, 199.0)]:
        cycle_len = 30
        for d in range(days):
            pos = (d % cycle_len) / cycle_len  # 0..1 through the cycle
            if pos < 0.8:
                # slow rise from trough toward peak
                low = trough + (peak - trough) * (pos / 0.8)
            else:
                # sharp fall back toward trough
                low = peak - (peak - trough) * ((pos - 0.8) / 0.2)
            low += random.uniform(-1.0, 1.0)
            rows.append(
                {
                    "date": (start + timedelta(days=d)).isoformat(),
                    "fuel_type": fuel,
                    "area": "Sydney",
                    "price": round(low, 1),
                }
            )
    return rows


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    snapshot = build_snapshot()
    with open(OUT_DIR / "current.json", "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, indent=2)
    with open(OUT_DIR / "daily_lows.json", "w", encoding="utf-8") as fh:
        json.dump(build_daily_lows(), fh, indent=2)
    print(
        f"Wrote {len(snapshot['stations'])} stations, "
        f"{len(snapshot['prices'])} prices to {OUT_DIR}/current.json"
    )


if __name__ == "__main__":
    main()
