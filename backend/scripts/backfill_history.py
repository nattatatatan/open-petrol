"""Seed the cache's daily-lows history from Data.NSW price-history XLSX files.

Download one or more monthly files from
https://data.nsw.gov.au/data/dataset/fuel-check and run:

    ./.venv/bin/python scripts/backfill_history.py path/to/history1.xlsx [more.xlsx ...]

This mitigates the production cold-start (CLAUDE.md §10): on a fresh deploy the
advisor has real, dated history immediately instead of being blind for weeks.
"""

from __future__ import annotations

import sys
from pathlib import Path

from app.cache.store import DEFAULT_AREA, PriceCache
from app.config import get_settings
from app.history.datansw import daily_lows_from_events, parse_history_xlsx


def main(paths: list[str]) -> None:
    if not paths:
        print(__doc__)
        sys.exit(1)
    settings = get_settings()
    cache = PriceCache(settings.cache_db_path)
    total = 0
    for p in paths:
        events = parse_history_xlsx(Path(p))
        rows = daily_lows_from_events(events, area=DEFAULT_AREA)
        total += cache.backfill_daily_lows(rows)
        print(f"{p}: {len(events)} events -> {len(rows)} daily lows")
    print(f"Backfilled {total} daily-low rows into {settings.cache_db_path}")


if __name__ == "__main__":
    main(sys.argv[1:])
