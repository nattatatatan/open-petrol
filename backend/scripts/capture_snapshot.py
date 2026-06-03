"""Capture a real dated snapshot from the live FuelCheck API.

Run this ONCE with valid FuelCheck credentials in backend/.env to overwrite the
demo current.json with a genuine live pull (CLAUDE.md build step 2 / §3). The demo
then runs on real, dated NSW data while staying offline and rate-limit-free.

    SOURCE=live ./.venv/bin/python scripts/capture_snapshot.py
"""

from __future__ import annotations

import asyncio
import json

from app.config import get_settings
from app.sources.live import LiveFuelCheckSource


async def main() -> None:
    s = get_settings()
    source = LiveFuelCheckSource(
        api_key=s.fuelcheck_api_key,
        api_secret=s.fuelcheck_api_secret,
        base_url=s.fuelcheck_base_url,
    )
    snapshot = await source.get_current_prices()
    s.snapshot_path.parent.mkdir(parents=True, exist_ok=True)
    with open(s.snapshot_path, "w", encoding="utf-8") as fh:
        json.dump(snapshot.model_dump(mode="json"), fh, indent=2)
    print(
        f"Captured {len(snapshot.stations)} stations / {len(snapshot.prices)} "
        f"prices at {snapshot.captured_at.isoformat()} -> {s.snapshot_path}"
    )


if __name__ == "__main__":
    asyncio.run(main())
