"""API contract tests. Uses the real snapshot source (no network); route/geocode
endpoints that need OSRM/Nominatim are smoke-tested separately."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_meta_and_near_me_served_from_cache():
    with TestClient(create_app()) as client:
        meta = client.get("/api/meta").json()
        assert meta["source"] == "snapshot"
        assert meta["station_count"] > 0
        assert set(meta["freshness_breakdown"]) == {"fresh", "ageing", "stale"}

        res = client.get(
            "/api/near-me",
            params={"lat": -33.8688, "lng": 151.2093, "fuel": "E10", "radius": 10},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["baseline"]["kind"] in ("area_average", "usual_station")
        assert body["recommended"] is not None
        assert body["recommended"]["fuel_type"] == "E10"


def test_catalog_lists_membership_presets():
    with TestClient(create_app()) as client:
        presets = client.get("/api/catalog").json()["presets"]
        keys = {p["key"] for p in presets}
        assert {"everyday_rewards", "flybuys", "nrma"} <= keys
        nrma = next(p for p in presets if p["key"] == "nrma")
        assert nrma["premium"] == 5  # fuel-tiered


def test_near_me_applies_membership_discount():
    with TestClient(create_app()) as client:
        res = client.get(
            "/api/near-me",
            params={
                "lat": -33.8688, "lng": 151.2093, "fuel": "E10",
                "radius": 10, "memberships": "everyday_rewards",
            },
        ).json()
        # At least one Ampol-family offer should carry the 4c docket discount.
        discounted = [o for o in res["offers"] if o["discount"] == 4.0]
        assert discounted
        assert discounted[0]["discount_label"] == "Woolworths Everyday Rewards"
        for o in res["offers"]:
            assert o["effective_price"] == round(o["price"] - o["discount"], 1)


def test_custom_discount_via_query():
    with TestClient(create_app()) as client:
        res = client.get(
            "/api/near-me",
            params={
                "lat": -33.8688, "lng": 151.2093, "fuel": "E10",
                "radius": 10, "custom_discounts": "Metro Fuel:6",
            },
        ).json()
        metro = [o for o in res["offers"] if o["brand"] == "Metro Fuel"]
        assert metro and all(o["discount"] == 6.0 for o in metro)


def test_station_search_typeahead():
    with TestClient(create_app()) as client:
        res = client.get(
            "/api/stations/search",
            params={"q": "ampol", "lat": -33.8688, "lng": 151.2093},
        )
        assert res.status_code == 200
        hits = res.json()
        assert len(hits) > 0
        assert all("ampol" in (h["name"] + (h["address"] or "")).lower() for h in hits)
        # Location given -> nearest first (non-decreasing distance).
        dists = [h["distance_km"] for h in hits]
        assert dists == sorted(dists)


class _FakeGeocoder:
    async def suggest(self, q: str, limit: int = 5):
        from app.routing.geocode import GeocodeResult
        return [
            GeocodeResult(latitude=-33.8, longitude=151.2, display_name=f"{q} {i}")
            for i in range(min(limit, 3))
        ]


def test_unknown_fuel_is_200_empty_not_500():
    # Regression: an unknown/zero-row fuel used to ZeroDivisionError -> HTTP 500.
    with TestClient(create_app()) as client:
        res = client.get(
            "/api/near-me",
            params={"lat": -33.8688, "lng": 151.2093, "fuel": "NOPE", "radius": 10},
        )
        assert res.status_code == 200
        body = res.json()
        assert body["offers"] == []
        assert body["recommended"] is None


def test_geocode_search_returns_suggestions():
    app = create_app()
    with TestClient(app) as client:
        app.state.geocoder = _FakeGeocoder()  # avoid hitting Nominatim in tests
        res = client.get("/api/geocode/search", params={"q": "parra"})
        assert res.status_code == 200
        body = res.json()
        assert len(body) == 3
        assert body[0]["display_name"].startswith("parra")
        assert "latitude" in body[0] and "longitude" in body[0]


def test_on_my_way_requires_a_destination():
    with TestClient(create_app()) as client:
        res = client.get(
            "/api/near-me", params={"lat": -33.8, "lng": 151.2, "fuel": "E10"}
        )
        assert res.status_code == 200
        # Missing dest entirely -> 422
        res = client.get(
            "/api/on-my-way",
            params={"origin_lat": -33.8, "origin_lng": 151.2, "fuel": "E10"},
        )
        assert res.status_code == 422
