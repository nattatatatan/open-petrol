"""Geo primitives. Pure, dependency-free."""

from __future__ import annotations

import math

EARTH_RADIUS_KM = 6371.0088


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two points in kilometres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2) ** 2
        + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    )
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


# --- corridor geometry (route-aware shortlisting) --------------------------
#
# For the cheap first-pass corridor filter (CLAUDE.md §7.5) we need the
# perpendicular distance from a station to the route polyline. Over the short
# spans involved an equirectangular projection to local kilometres is accurate
# enough and far cheaper than per-segment great-circle math.

Point = tuple[float, float]  # (lat, lng)


def _to_xy(lat: float, lng: float, ref_lat: float) -> tuple[float, float]:
    x = math.radians(lng) * math.cos(math.radians(ref_lat)) * EARTH_RADIUS_KM
    y = math.radians(lat) * EARTH_RADIUS_KM
    return x, y


def _point_to_segment_km(p: Point, a: Point, b: Point, ref_lat: float) -> float:
    px, py = _to_xy(p[0], p[1], ref_lat)
    ax, ay = _to_xy(a[0], a[1], ref_lat)
    bx, by = _to_xy(b[0], b[1], ref_lat)
    dx, dy = bx - ax, by - ay
    seg_len_sq = dx * dx + dy * dy
    if seg_len_sq == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / seg_len_sq
    t = max(0.0, min(1.0, t))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def point_to_polyline_km(point: Point, polyline: list[Point]) -> float:
    """Shortest distance (km) from a point to a route polyline."""
    if not polyline:
        return float("inf")
    if len(polyline) == 1:
        return haversine_km(point[0], point[1], polyline[0][0], polyline[0][1])
    ref_lat = point[0]
    return min(
        _point_to_segment_km(point, polyline[i], polyline[i + 1], ref_lat)
        for i in range(len(polyline) - 1)
    )
