"""PriceCache — our own store, the thing every user request is served from.

Cache-first is the whole architecture (CLAUDE.md §2): the scheduler fills this from
the active FuelSource on an interval; user queries NEVER hit FuelCheck. Two jobs:
  1. Hold the latest snapshot (and keep the last-good one on refresh failure, so we
     degrade gracefully to slightly-stale-with-a-banner rather than a blank screen).
  2. Accumulate a daily-lows history series from each poll — which is how the live
     path gets a price-cycle series despite FuelCheck having no trends endpoint
     (CLAUDE.md §10).
"""

from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.models import DailyLow, Snapshot
from app.sources.base import FuelSource

# v1 simplification: a single coarse area bucket for cycle reasoning (NSW metro).
DEFAULT_AREA = "Sydney"


@dataclass
class CacheStatus:
    has_data: bool
    captured_at: datetime | None
    fetched_at: datetime | None
    last_success_at: datetime | None
    last_error: str | None
    stale_refresh: bool  # True when the most recent refresh attempt failed


class PriceCache:
    def __init__(self, db_path: Path) -> None:
        self._db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS snapshot (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    captured_at TEXT NOT NULL,
                    fetched_at TEXT NOT NULL,
                    payload TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS refresh_meta (
                    id INTEGER PRIMARY KEY CHECK (id = 1),
                    last_success_at TEXT,
                    last_attempt_at TEXT,
                    last_error TEXT
                );
                CREATE TABLE IF NOT EXISTS daily_lows (
                    date TEXT NOT NULL,
                    fuel_type TEXT NOT NULL,
                    area TEXT NOT NULL,
                    price REAL NOT NULL,
                    PRIMARY KEY (date, fuel_type, area)
                );
                """
            )

    # --- refresh (scheduler-driven) ----------------------------------------

    async def refresh(self, source: FuelSource) -> bool:
        """Pull a fresh snapshot from the source and store it. On failure, keep
        the last-good snapshot and record the error. Returns True on success."""
        now = datetime.now(timezone.utc).isoformat()
        try:
            snapshot = await source.get_current_prices()
        except Exception as exc:  # noqa: BLE001 - we want to degrade on ANY failure
            with self._connect() as conn:
                conn.execute(
                    """INSERT INTO refresh_meta (id, last_attempt_at, last_error)
                       VALUES (1, ?, ?)
                       ON CONFLICT(id) DO UPDATE SET
                         last_attempt_at = excluded.last_attempt_at,
                         last_error = excluded.last_error""",
                    (now, f"{type(exc).__name__}: {exc}"),
                )
            return False

        payload = json.dumps(snapshot.model_dump(mode="json"))
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO snapshot (id, captured_at, fetched_at, payload)
                   VALUES (1, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                     captured_at = excluded.captured_at,
                     fetched_at = excluded.fetched_at,
                     payload = excluded.payload""",
                (snapshot.captured_at.isoformat(), now, payload),
            )
            conn.execute(
                """INSERT INTO refresh_meta (id, last_success_at, last_attempt_at, last_error)
                   VALUES (1, ?, ?, NULL)
                   ON CONFLICT(id) DO UPDATE SET
                     last_success_at = excluded.last_success_at,
                     last_attempt_at = excluded.last_attempt_at,
                     last_error = NULL""",
                (now, now),
            )
        self._accumulate_daily_lows(snapshot)
        return True

    def _accumulate_daily_lows(self, snapshot: Snapshot) -> None:
        """Record today's lowest price per fuel type (area-wide) from this poll.
        UPSERT to the running minimum so multiple polls a day keep the true low."""
        day = snapshot.captured_at.date().isoformat()
        lows: dict[str, float] = {}
        for p in snapshot.prices:
            if p.fuel_type not in lows or p.price < lows[p.fuel_type]:
                lows[p.fuel_type] = p.price
        with self._connect() as conn:
            for fuel, price in lows.items():
                conn.execute(
                    """INSERT INTO daily_lows (date, fuel_type, area, price)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(date, fuel_type, area) DO UPDATE SET
                         price = MIN(daily_lows.price, excluded.price)""",
                    (day, fuel, DEFAULT_AREA, price),
                )

    # --- backfill (production cold-start, CLAUDE.md §10) -------------------

    def backfill_daily_lows(self, rows: list[DailyLow]) -> int:
        """Seed historical daily lows (e.g. parsed from Data.NSW history files) so
        the advisor isn't dead for weeks on a fresh deploy. Only fills gaps."""
        with self._connect() as conn:
            for r in rows:
                conn.execute(
                    """INSERT INTO daily_lows (date, fuel_type, area, price)
                       VALUES (?, ?, ?, ?)
                       ON CONFLICT(date, fuel_type, area) DO UPDATE SET
                         price = MIN(daily_lows.price, excluded.price)""",
                    (r.date, r.fuel_type, r.area, r.price),
                )
        return len(rows)

    # --- reads (user-request path) -----------------------------------------

    def get_snapshot(self) -> Snapshot | None:
        with self._connect() as conn:
            row = conn.execute("SELECT payload FROM snapshot WHERE id = 1").fetchone()
        if row is None:
            return None
        return Snapshot.model_validate(json.loads(row["payload"]))

    def get_history(self, fuel_type: str, area: str, days: int) -> list[DailyLow]:
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT date, fuel_type, area, price FROM daily_lows
                   WHERE fuel_type = ? AND area = ?
                   ORDER BY date DESC LIMIT ?""",
                (fuel_type, area, days),
            ).fetchall()
        out = [DailyLow(**dict(r)) for r in rows]
        out.reverse()
        return out

    def status(self) -> CacheStatus:
        with self._connect() as conn:
            snap = conn.execute(
                "SELECT captured_at, fetched_at FROM snapshot WHERE id = 1"
            ).fetchone()
            meta = conn.execute(
                "SELECT last_success_at, last_attempt_at, last_error FROM refresh_meta WHERE id = 1"
            ).fetchone()

        def _dt(val: str | None) -> datetime | None:
            return datetime.fromisoformat(val) if val else None

        last_attempt = _dt(meta["last_attempt_at"]) if meta else None
        last_success = _dt(meta["last_success_at"]) if meta else None
        return CacheStatus(
            has_data=snap is not None,
            captured_at=_dt(snap["captured_at"]) if snap else None,
            fetched_at=_dt(snap["fetched_at"]) if snap else None,
            last_success_at=last_success,
            last_error=meta["last_error"] if meta else None,
            stale_refresh=bool(
                last_attempt and last_success and last_attempt > last_success
            ),
        )

    # --- async adapter for LiveFuelCheckSource.history_provider ------------

    async def history_provider(
        self, fuel_type: str, area: str, days: int
    ) -> list[DailyLow]:
        return self.get_history(fuel_type, area, days)
