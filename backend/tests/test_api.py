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


def test_meta_exposes_membership_programs():
    with TestClient(create_app()) as client:
        meta = client.get("/api/meta").json()
        assert "woolworths" in meta["discount_programs"]
        assert meta["discount_programs"]["woolworths"]["label"]


def test_near_me_applies_membership_discount():
    with TestClient(create_app()) as client:
        res = client.get(
            "/api/near-me",
            params={
                "lat": -33.8688, "lng": 151.2093, "fuel": "E10",
                "radius": 10, "membership": "woolworths",
            },
        ).json()
        # At least one Ampol-family offer should carry the 4c docket discount.
        assert any(o["discount"] == 4.0 for o in res["offers"])
        for o in res["offers"]:
            assert o["effective_price"] == round(o["price"] - o["discount"], 1)


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
