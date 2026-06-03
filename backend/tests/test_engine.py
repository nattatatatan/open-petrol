from datetime import datetime, timedelta, timezone

from app.engine.geo import haversine_km
from app.engine.recommend import compute_baseline, find_cheapest_stations
from app.models import Freshness, Location, Price, Snapshot, Station

CAPTURED = datetime(2026, 6, 2, 8, 30, tzinfo=timezone.utc)
ORIGIN = (-33.87, 151.21)

# Three E10 stations chosen so area average = exactly 175.0:
#   NEAR  ~1km,   179.0, fresh
#   FAR   ~12km,  176.0, fresh   (cheaper at pump, but far)
#   STALE ~0.5km, 170.0, 3 days old (cheapest, but stale)
STATIONS = [
    Station(code="NEAR", name="Near", brand="Metro", location=Location(latitude=-33.87, longitude=151.221)),
    Station(code="FAR", name="Far", brand="Costco", location=Location(latitude=-33.87, longitude=151.34)),
    Station(code="STALE", name="Stale", brand="BP", location=Location(latitude=-33.87, longitude=151.215)),
]
PRICES = [
    Price(station_code="NEAR", fuel_type="E10", price=179.0, last_updated=CAPTURED),
    Price(station_code="FAR", fuel_type="E10", price=176.0, last_updated=CAPTURED),
    Price(station_code="STALE", fuel_type="E10", price=170.0, last_updated=CAPTURED - timedelta(days=3)),
]
SNAP = Snapshot(captured_at=CAPTURED, stations=STATIONS, prices=PRICES)


def test_haversine_sanity():
    # Sydney CBD -> Parramatta is ~23 km.
    d = haversine_km(-33.8688, 151.2093, -33.8150, 151.0011)
    assert 20 < d < 26


def test_area_average_baseline_and_saving_math():
    res = find_cheapest_stations(
        SNAP, origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
        fuel_type="E10", tank_l=55, radius_km=15,
    )
    assert res.baseline.kind == "area_average"
    assert res.baseline.price == 175.0
    near = next(o for o in res.offers if o.station_code == "NEAR")
    assert near.saving_per_litre == -4.0          # 175 - 179
    assert near.saving_per_tank == -2.2           # -4 * 55 / 100


def test_usual_station_baseline_overrides_area_average():
    base = compute_baseline(
        {p.station_code: p for p in PRICES}, usual_station_code="FAR"
    )
    assert base.kind == "usual_station"
    assert base.price == 176.0


def test_ranks_net_of_detour_not_raw_price():
    # FAR is cheaper at the pump than NEAR, but the 12km detour should sink it.
    res = find_cheapest_stations(
        SNAP, origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
        fuel_type="E10", tank_l=55, radius_km=15,
    )
    near = next(o for o in res.offers if o.station_code == "NEAR")
    far = next(o for o in res.offers if o.station_code == "FAR")
    assert near.net_benefit > far.net_benefit
    assert res.recommended.station_code == "NEAR"


def test_stale_price_is_deranked_not_recommended():
    # STALE is cheapest with the best net benefit, but it's 3 days old.
    res = find_cheapest_stations(
        SNAP, origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
        fuel_type="E10", tank_l=55, radius_km=15,
    )
    stale = next(o for o in res.offers if o.station_code == "STALE")
    assert stale.freshness is Freshness.STALE
    assert stale.net_benefit == max(o.net_benefit for o in res.offers)
    assert res.recommended.station_code != "STALE"   # de-ranked despite best net


def test_radius_filters_out_distant_stations():
    res = find_cheapest_stations(
        SNAP, origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
        fuel_type="E10", tank_l=55, radius_km=8,   # excludes FAR (~12km)
    )
    assert {o.station_code for o in res.offers} == {"NEAR", "STALE"}
