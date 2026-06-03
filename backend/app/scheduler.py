"""Scheduled refresh — the only thing that calls the FuelSource.

This is what makes dev mirror production (CLAUDE.md §2, §9): an in-process
APScheduler job polls the source on an interval into the cache. It runs once
immediately on startup so there's data to serve, then every N minutes. In the
single-monolith deploy this lives inside the FastAPI process.
"""

from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.cache.store import PriceCache
from app.sources.base import FuelSource

logger = logging.getLogger("petrol.scheduler")


async def refresh_job(cache: PriceCache, source: FuelSource) -> None:
    ok = await cache.refresh(source)
    if ok:
        status = cache.status()
        logger.info("refresh ok via %s (captured_at=%s)", source.name, status.captured_at)
    else:
        logger.warning("refresh FAILED via %s; serving last-good cache", source.name)


def start_scheduler(
    cache: PriceCache, source: FuelSource, interval_minutes: int
) -> AsyncIOScheduler:
    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        refresh_job,
        "interval",
        minutes=interval_minutes,
        args=[cache, source],
        id="fuel_refresh",
        max_instances=1,
        coalesce=True,
    )
    scheduler.start()
    return scheduler
