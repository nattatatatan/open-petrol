import type {
  AdvisorResult,
  Meta,
  NearMeResult,
  RouteResult,
} from "./types";

async function get<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const res = await fetch(`${path}?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => get<Meta>("/api/meta", {}),

  nearMe: (p: {
    lat: number; lng: number; fuel: string; tank: number; radius: number; usual?: string | null;
  }) =>
    get<NearMeResult>("/api/near-me", {
      lat: p.lat, lng: p.lng, fuel: p.fuel, tank: p.tank, radius: p.radius,
      usual_station: p.usual ?? undefined,
    }),

  onMyWay: (p: {
    originLat: number; originLng: number; dest: string; fuel: string; tank: number; usual?: string | null;
  }) =>
    get<RouteResult>("/api/on-my-way", {
      origin_lat: p.originLat, origin_lng: p.originLng, dest: p.dest,
      fuel: p.fuel, tank: p.tank, usual_station: p.usual ?? undefined,
    }),

  geocode: (q: string) =>
    get<{ latitude: number; longitude: number; display_name: string }>("/api/geocode", { q }),

  advisor: async (body: Record<string, unknown>): Promise<AdvisorResult> => {
    const res = await fetch("/api/advisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const b = await res.json().catch(() => ({}));
      throw new Error(b.detail || `Advisor failed (${res.status})`);
    }
    return res.json() as Promise<AdvisorResult>;
  },
};
