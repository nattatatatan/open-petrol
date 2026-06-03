"""FastAPI application — the single-monolith deploy (CLAUDE.md §9).

One process: serves the API, runs the in-process scheduled refresh, and (in prod)
serves the built React bundle. No CORS, one deploy target.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.advisor.service import AdvisorService
from app.api.routes import router as api_router
from app.cache.store import PriceCache
from app.config import get_settings
from app.routing.geocode import Geocoder
from app.routing.osrm import RoutingService
from app.scheduler import refresh_job, start_scheduler
from app.sources.factory import build_source

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("petrol")

# Built frontend (created by `npm run build`); optional in dev.
FRONTEND_DIST = Path(__file__).resolve().parent.parent.parent / "frontend-app" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    cache = PriceCache(settings.cache_db_path)
    # Live source reads its history from the cache we accumulate (no trends endpoint).
    source = build_source(settings, history_provider=cache.history_provider)

    app.state.settings = settings
    app.state.cache = cache
    app.state.source = source
    app.state.routing = RoutingService(settings.osrm_base_url, settings.user_agent)
    app.state.geocoder = Geocoder(settings.nominatim_base_url, settings.user_agent)
    app.state.advisor = AdvisorService(settings, cache, source)

    # Fill the cache immediately so there's data to serve, then schedule refreshes.
    await refresh_job(cache, source)
    scheduler = start_scheduler(cache, source, settings.refresh_interval_minutes)
    logger.info(
        "started: source=%s refresh=%dmin frontend=%s",
        source.name, settings.refresh_interval_minutes, FRONTEND_DIST.exists(),
    )
    try:
        yield
    finally:
        scheduler.shutdown(wait=False)


def create_app() -> FastAPI:
    app = FastAPI(title="Smart Petrol Finder", lifespan=lifespan)
    app.include_router(api_router)
    if FRONTEND_DIST.exists():
        app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
    return app


app = create_app()
