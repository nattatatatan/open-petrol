from datetime import datetime, timezone

from app.engine.geo import point_to_polyline_km
from app.engine.route import recommend_along_route
from app.models import Location, Price, Snapshot, Station
from app.routing.osrm import Detour, Point, Route

CAPTURED = datetime(2026, 6, 2, 8, 30, tzinfo=timezone.utc)

# A roughly east-west route along latitude -33.87.
ORIGIN: Point = (-33.87, 151.10)
DEST: Point = (-33.87, 151.30)
ROUTE_LINE = [(-33.87, 151.10 + i * 0.02) for i in range(11)]  # 151.10 -> 151.30


def test_point_to_polyline_perpendicular_distance():
    line = [(-33.87, 151.10), (-33.87, 151.30)]
    # ~0.01 deg latitude off the line ≈ 1.1 km
    d = point_to_polyline_km((-33.86, 151.20), line)
    assert 1.0 < d < 1.3
    # A point on the line is ~0.
    assert point_to_polyline_km((-33.87, 151.20), line) < 0.05


class FakeRouting:
    """Deterministic stand-in for OSRM: straight-line route, detour derived from
    the perpendicular offset so tests need no network."""

    async def route(self, points, alternatives=False):
        return [Route(
            geometry=ROUTE_LINE,
            distance_km=20.0,
            duration_min=20.0,
            leg_distances_km=[10.0, 10.0],
        )]

    async def detour(self, origin, via, dest, direct):
        perp = point_to_polyline_km(via, ROUTE_LINE)
        return Detour(extra_km=round(perp * 2, 3), extra_min=round(perp * 3, 3), along_route_km=10.0)


def _snapshot() -> Snapshot:
    stations = [
        Station(code="ON", name="On route", location=Location(latitude=-33.87, longitude=151.20)),
        Station(code="NEAR", name="Just off", location=Location(latitude=-33.875, longitude=151.15)),
        Station(code="OFF", name="Off corridor", location=Location(latitude=-33.90, longitude=151.25)),
    ]
    prices = [
        Price(station_code="ON", fuel_type="E10", price=180.0, last_updated=CAPTURED),
        Price(station_code="NEAR", fuel_type="E10", price=175.0, last_updated=CAPTURED),
        Price(station_code="OFF", fuel_type="E10", price=160.0, last_updated=CAPTURED),
    ]
    return Snapshot(captured_at=CAPTURED, stations=stations, prices=prices)


async def test_corridor_excludes_off_route_station():
    res = await recommend_along_route(
        _snapshot(), FakeRouting(),
        origin=ORIGIN, destination=DEST, fuel_type="E10",
        corridor_buffer_km=2.0,
    )
    codes = {o.station_code for o in res.offers}
    assert "OFF" not in codes          # ~3.3km off the corridor -> filtered
    assert codes == {"ON", "NEAR"}


async def test_route_recommends_best_net_of_detour_in_corridor():
    res = await recommend_along_route(
        _snapshot(), FakeRouting(),
        origin=ORIGIN, destination=DEST, fuel_type="E10",
        corridor_buffer_km=2.0,
    )
    # NEAR is cheaper than ON and still in-corridor -> should win.
    assert res.recommended.station_code == "NEAR"
    assert res.recommended.detour_min is not None
    assert res.route_geometry and res.direct_distance_km == 20.0
