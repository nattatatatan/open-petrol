"""LiveFuelCheckSource — the real NSW FuelCheck API.

Built to PROVE the path (CLAUDE.md §3); the demo never depends on it. Spike
findings baked in here:
  * OAuth2 client-credentials -> bearer token (~12h), cached & refreshed lazily.
  * Bulk endpoint GET /FuelPriceCheck/v2/fuel/prices returns ALL prices in one call.
  * `requesttimestamp` MUST be `DD/MM/YYYY hh:mm:ss AM/PM` — the #1 cause of 401s.
  * The current v1/v2 API has NO trends endpoint, so historical lows come from the
    cache we accumulate (injected via `history_provider`), not from FuelCheck.
"""

from __future__ import annotations

import base64
import uuid
from datetime import datetime, timedelta, timezone
from typing import Awaitable, Callable
from zoneinfo import ZoneInfo

import httpx

# FuelCheck reports prices in NSW local time (no offset in the payload).
_NSW_TZ = ZoneInfo("Australia/Sydney")

from app.models import DailyLow, Location, Price, Snapshot, Station
from app.sources.base import FuelSource

HistoryProvider = Callable[[str, str, int], Awaitable[list[DailyLow]]]

# FuelCheck's exact required timestamp format.
_TIMESTAMP_FMT = "%d/%m/%Y %I:%M:%S %p"
# How it returns per-price last-updated values.
_LASTUPDATED_FMT = "%d/%m/%Y %H:%M:%S"


class LiveFuelCheckSource(FuelSource):
    name = "live"

    def __init__(
        self,
        api_key: str,
        api_secret: str,
        base_url: str,
        history_provider: HistoryProvider | None = None,
    ) -> None:
        if not api_key or not api_secret:
            raise ValueError(
                "LiveFuelCheckSource requires FUELCHECK_API_KEY and "
                "FUELCHECK_API_SECRET (set them in backend/.env)."
            )
        self._api_key = api_key
        self._api_secret = api_secret
        self._base_url = base_url.rstrip("/")
        self._history_provider = history_provider
        self._token: str | None = None
        self._token_expiry: datetime | None = None

    # --- auth ---------------------------------------------------------------

    async def _get_token(self, client: httpx.AsyncClient) -> str:
        now = datetime.now(timezone.utc)
        if self._token and self._token_expiry and now < self._token_expiry:
            return self._token

        basic = base64.b64encode(
            f"{self._api_key}:{self._api_secret}".encode()
        ).decode()
        resp = await client.get(
            f"{self._base_url}/oauth/client_credential/accesstoken",
            params={"grant_type": "client_credentials"},
            headers={"Authorization": f"Basic {basic}"},
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data["access_token"]
        # Tokens last ~12h; refresh a little early to be safe.
        expires_in = int(data.get("expires_in", 43199))
        self._token_expiry = now + timedelta(seconds=expires_in - 60)
        return self._token

    def _request_headers(self, token: str) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {token}",
            "apikey": self._api_key,
            "transactionid": str(uuid.uuid4()),
            "requesttimestamp": datetime.now(timezone.utc).strftime(_TIMESTAMP_FMT),
            "Content-Type": "application/json",
        }

    # --- FuelSource ---------------------------------------------------------

    async def get_current_prices(self) -> Snapshot:
        async with httpx.AsyncClient(timeout=30.0) as client:
            token = await self._get_token(client)
            resp = await client.get(
                f"{self._base_url}/FuelPriceCheck/v2/fuel/prices",
                headers=self._request_headers(token),
            )
            resp.raise_for_status()
            return self._parse_snapshot(resp.json())

    async def get_historical_lows(
        self, fuel_type: str, area: str, days: int
    ) -> list[DailyLow]:
        # No trends endpoint exists; history is what we've accumulated in cache
        # (plus launch backfill). Wired by the cache layer.
        if self._history_provider is None:
            return []
        return await self._history_provider(fuel_type, area, days)

    # --- parsing ------------------------------------------------------------

    @staticmethod
    def _parse_lastupdated(raw: str) -> datetime:
        # FuelCheck reports NSW local time (UTC+10/+11). Parse it AS NSW-local then
        # convert to UTC — stamping the naive value as UTC would shift every price
        # ~10–11h into the "future" vs captured_at and mis-classify freshness (the
        # trust thesis). Snapshots already carry real UTC ISO timestamps; this is the
        # live-path fix.
        dt = datetime.strptime(raw, _LASTUPDATED_FMT).replace(tzinfo=_NSW_TZ)
        return dt.astimezone(timezone.utc)

    def _parse_snapshot(self, payload: dict) -> Snapshot:
        stations: list[Station] = []
        for s in payload.get("stations", []):
            loc = s.get("location") or {}
            stations.append(
                Station(
                    code=str(s["code"]),
                    name=s.get("name", ""),
                    brand=s.get("brand"),
                    address=s.get("address"),
                    location=Location(
                        latitude=float(loc.get("latitude", 0.0)),
                        longitude=float(loc.get("longitude", 0.0)),
                    ),
                )
            )

        prices: list[Price] = []
        for p in payload.get("prices", []):
            prices.append(
                Price(
                    station_code=str(p["stationcode"]),
                    fuel_type=str(p["fueltype"]),
                    price=float(p["price"]),
                    last_updated=self._parse_lastupdated(p["lastupdated"]),
                )
            )

        return Snapshot(
            captured_at=datetime.now(timezone.utc),
            stations=stations,
            prices=prices,
        )
