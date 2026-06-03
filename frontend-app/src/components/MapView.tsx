import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import { LatLngBounds } from "leaflet";
import type { StationOffer } from "../types";
import { formatCents } from "../lib/format";

type LatLng = [number, number];

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(new LatLngBounds(points), { padding: [36, 36] });
  }, [map, points]);
  return null;
}

export function MapView({
  offers,
  origin,
  destination,
  route,
  theme,
  interactive = true,
  heightClass = "h-[260px]",
}: {
  offers: StationOffer[];
  origin: LatLng | null;
  destination: LatLng | null;
  route: LatLng[];
  theme: "dark" | "light";
  /** Static strip mode (STYLE_GUIDE §7): all gestures off, used as a glanceable
   *  preview that a parent overlays with a tap-to-expand affordance. */
  interactive?: boolean;
  heightClass?: string;
}) {
  const stationPoints = offers.map((o) => [o.latitude, o.longitude] as LatLng);
  const allPoints: LatLng[] = [
    ...route,
    ...stationPoints,
    ...(origin ? [origin] : []),
    ...(destination ? [destination] : []),
  ];
  const center: LatLng = origin ?? stationPoints[0] ?? [-33.8688, 151.2093];

  const tiles =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={false}
      dragging={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      boxZoom={interactive}
      keyboard={interactive}
      zoomControl={interactive}
      attributionControl={interactive}
      className={`${heightClass} w-full`}
      style={{ zIndex: 0, pointerEvents: interactive ? "auto" : "none" }}
    >
      <TileLayer
        url={tiles}
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      <FitBounds points={allPoints} />

      {route.length > 1 && (
        <Polyline positions={route} pathOptions={{ color: "#68AEE2", weight: 4, opacity: 0.7 }} />
      )}

      {origin && (
        <CircleMarker center={origin} radius={7}
          pathOptions={{ color: "#fff", fillColor: "#68AEE2", fillOpacity: 1, weight: 2 }}>
          <Popup>Start</Popup>
        </CircleMarker>
      )}
      {destination && (
        <CircleMarker center={destination} radius={7}
          pathOptions={{ color: "#fff", fillColor: "#FD5422", fillOpacity: 1, weight: 2 }}>
          <Popup>Destination</Popup>
        </CircleMarker>
      )}

      {offers.map((o) => {
        const recommended = o.is_recommended;
        return (
          <CircleMarker
            key={o.station_code}
            center={[o.latitude, o.longitude]}
            radius={recommended ? 10 : 6}
            pathOptions={{
              color: recommended ? "#000" : "#18191a",
              weight: recommended ? 2 : 1,
              fillColor: recommended ? "#F2AC59" : o.freshness === "stale" ? "#72777E" : "#D2D7DF",
              fillOpacity: 1,
            }}
          >
            <Popup>
              <strong>{o.name}</strong>
              <br />
              <span className="mono">{formatCents(o.price)}c/L</span> · {o.fuel_type}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
