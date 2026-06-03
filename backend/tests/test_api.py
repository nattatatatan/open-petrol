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
