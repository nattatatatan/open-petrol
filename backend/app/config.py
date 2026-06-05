"""Application configuration, loaded from environment / .env.

The single most important knob is `SOURCE`: flipping it between `snapshot` and
`live` swaps the data adapter with zero downstream impact (CLAUDE.md §3). The demo
runs on `snapshot`; `live` proves the real FuelCheck path.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BACKEND_DIR / "data"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=BACKEND_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Data source: "snapshot" (demo, default) | "live" (real FuelCheck API)
    source: str = "snapshot"

    # Where the captured snapshot + seeded history live (used by SnapshotSource)
    snapshot_path: Path = DATA_DIR / "snapshot" / "current.json"
    history_path: Path = DATA_DIR / "snapshot" / "daily_lows.json"

    # SQLite cache store
    cache_db_path: Path = DATA_DIR / "cache.db"

    # Scheduled refresh interval (minutes). 30–60 in dev keeps us under the
    # 2,500 calls/month free tier (CLAUDE.md §2).
    refresh_interval_minutes: int = 45

    # FuelCheck (LiveFuelCheckSource) — never commit real values; use .env
    fuelcheck_api_key: str = ""
    fuelcheck_api_secret: str = ""
    fuelcheck_base_url: str = "https://api.onegov.nsw.gov.au"

    # External geometry services (keyless)
    osrm_base_url: str = "https://router.project-osrm.org"
    nominatim_base_url: str = "https://nominatim.openstreetmap.org"

    # Identify ourselves politely to Nominatim (required by their usage policy)
    user_agent: str = "smart-petrol-finder/1.0 (assessment project)"


@lru_cache
def get_settings() -> Settings:
    return Settings()
