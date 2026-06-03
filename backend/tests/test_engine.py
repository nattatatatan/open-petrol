from datetime import datetime, timedelta, timezone

from app.engine.geo import haversine_km
from app.engine.discounts import MembershipSelection, resolve_discounts
from app.engine.recommend import (
    Baseline,
    build_offer,
    compute_baseline,
    find_cheapest_stations,
)
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


def test_value_of_time_is_included_in_detour_cost():
    base = Baseline(kind="area_average", price=180.0, label="x")
    station = Station(code="X", name="X", location=Location(latitude=-33.8, longitude=151.2))
    price = Price(station_code="X", fuel_type="E10", price=170.0, last_updated=CAPTURED)
    o = build_offer(
        station, price, baseline=base, reference_time=CAPTURED,
        distance_km=5, detour_km=10, tank_l=55, consumption_l_per_km=0.08,
        detour_min=15,
    )
    saving = (180 - 170) * 55 / 100        # 5.50
    fuel = 10 * 0.08 * 1.70                 # 1.36
    time = 15 / 60 * 12                     # 3.00 (value of time, not just fuel)
    assert o.detour_cost == round(fuel + time, 2)       # 4.36
    assert o.net_benefit == round(saving - (fuel + time), 2)  # 1.14


# Two near stations: a cheaper-at-pump Metro and a dearer Ampol that a Woolworths
# docket (4c) makes cheaper for the cardholder.
MEMBER_STATIONS = [
    Station(code="METRO", name="Metro", brand="Metro Fuel", location=Location(latitude=-33.87, longitude=151.221)),
    Station(code="AMPOL", name="Ampol", brand="Ampol", location=Location(latitude=-33.87, longitude=151.221)),
]
MEMBER_PRICES = [
    Price(station_code="METRO", fuel_type="E10", price=179.0, last_updated=CAPTURED),
    Price(station_code="AMPOL", fuel_type="E10", price=180.0, last_updated=CAPTURED),
]
MEMBER_SNAP = Snapshot(captured_at=CAPTURED, stations=MEMBER_STATIONS, prices=MEMBER_PRICES)


def test_discounts_only_map_covered_brands():
    sel = MembershipSelection(memberships=["everyday_rewards"])
    d = resolve_discounts(MEMBER_STATIONS, "E10", sel)
    assert d["AMPOL"] == (4.0, "Woolworths Everyday Rewards")
    assert "METRO" not in d                                   # Metro isn't covered
    assert resolve_discounts(MEMBER_STATIONS, "E10", MembershipSelection()) == {}


def test_membership_best_single_no_stacking():
    # Two cards both cover Ampol; we take the single best (5c), never the sum.
    sel = MembershipSelection(memberships=["everyday_rewards", "racv"])
    d = resolve_discounts(MEMBER_STATIONS, "E10", sel)
    assert d["AMPOL"][0] == 5.0          # max(4, 5), NOT 9


def test_membership_premium_tier_and_rate_override():
    # NRMA pays 5c on premium fuel, 4c otherwise.
    nrma = MembershipSelection(memberships=["nrma"])
    assert resolve_discounts(MEMBER_STATIONS, "P98", nrma)["AMPOL"][0] == 5.0
    assert resolve_discounts(MEMBER_STATIONS, "E10", nrma)["AMPOL"][0] == 4.0
    # A user-owned rate override (e.g. a 10c docket week) replaces the default.
    bumped = MembershipSelection(memberships=["everyday_rewards"], rate_overrides={"everyday_rewards": 10.0})
    assert resolve_discounts(MEMBER_STATIONS, "E10", bumped)["AMPOL"][0] == 10.0


def test_custom_rule_applies_to_its_brand():
    sel = MembershipSelection(custom_rules=[("Metro Fuel", 7.0)])
    d = resolve_discounts(MEMBER_STATIONS, "E10", sel)
    assert d["METRO"] == (7.0, "Metro Fuel")


def test_membership_flips_the_winner_via_effective_price():
    # No card: Metro (179) is cheaper at the pump than Ampol (180).
    plain = find_cheapest_stations(
        MEMBER_SNAP, origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
        fuel_type="E10", tank_l=55, radius_km=15,
    )
    assert plain.recommended.station_code == "METRO"

    # With Everyday Rewards, Ampol's effective price is 176 — it should win.
    member = find_cheapest_stations(
        MEMBER_SNAP, origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
        fuel_type="E10", tank_l=55, radius_km=15,
        membership=MembershipSelection(memberships=["everyday_rewards"]),
    )
    ampol = next(o for o in member.offers if o.station_code == "AMPOL")
    assert member.recommended.station_code == "AMPOL"
    assert ampol.discount == 4.0
    assert ampol.effective_price == 176.0
    assert ampol.price == 180.0          # pump price stays visible
    assert ampol.discount_label == "Woolworths Everyday Rewards"


def test_membership_baseline_uses_effective_prices():
    base = compute_baseline(
        {p.station_code: p for p in MEMBER_PRICES},
        usual_station_code=None,
        discounts={"AMPOL": 4.0},
    )
    # Effective area average = (179 + 176) / 2 = 177.5, not the pump 179.5.
    assert base.price == 177.5


def test_radius_filters_out_distant_stations():
    res = find_cheapest_stations(
        SNAP, origin_lat=ORIGIN[0], origin_lng=ORIGIN[1],
        fuel_type="E10", tank_l=55, radius_km=8,   # excludes FAR (~12km)
    )
    assert {o.station_code for o in res.offers} == {"NEAR", "STALE"}
