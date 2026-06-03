import { useCallback, useState } from "react";

export type GeoStatus = "idle" | "locating" | "granted" | "denied" | "unavailable";

export interface Coords {
  lat: number;
  lng: number;
  label: string;
}

/** Geolocation with a graceful manual fallback (CLAUDE.md §5, §11). The caller
 *  shows a suburb input when status is "denied" / "unavailable". */
export function useGeolocation() {
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Your location",
        });
        setStatus("granted");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const setManual = useCallback((c: Coords) => {
    setCoords(c);
    setStatus("granted");
  }, []);

  return { status, coords, request, setManual };
}
