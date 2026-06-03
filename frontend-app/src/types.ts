export type Freshness = "fresh" | "ageing" | "stale";

export interface Baseline {
  kind: "usual_station" | "area_average";
  price: number;
  label: string;
}

export interface StationOffer {
  station_code: string;
  name: string;
  brand: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  fuel_type: string;
  price: number;
  discount: number;
  effective_price: number;
  last_updated: string;
  freshness: Freshness;
  distance_km: number;
  detour_km: number;
  saving_per_litre: number;
  saving_per_tank: number;
  detour_cost: number;
  net_benefit: number;
  is_recommended: boolean;
  detour_min: number | null;
  along_route_km: number | null;
}

export interface NearMeResult {
  fuel_type: string;
  captured_at: string;
  tank_l: number;
  baseline: Baseline;
  offers: StationOffer[];
  recommended: StationOffer | null;
}

export interface RouteResult extends NearMeResult {
  origin: [number, number];
  destination: [number, number];
  route_geometry: [number, number][];
  direct_distance_km: number;
  direct_duration_min: number;
}

export interface Meta {
  source: string;
  captured_at: string | null;
  fetched_at: string | null;
  last_success_at: string | null;
  stale_refresh: boolean;
  last_error: string | null;
  station_count: number;
  price_count: number;
  freshness_breakdown: Record<Freshness, number>;
  fuel_types: Record<string, string>;
  discount_programs: Record<string, { label: string; note: string }>;
  provider: string;
  now: string;
}

export interface StationHit {
  code: string;
  name: string;
  brand: string | null;
  address: string | null;
  distance_km: number | null;
}

export interface AdvisorResult {
  verdict: "fill_now" | "wait" | "cheapest_now";
  headline: string;
  detail: string;
  confidence: "high" | "low";
  phase: string | null;
  wait_days: number | null;
  expected_saving_per_tank: number | null;
  basis: string;
  source: "llm" | "deterministic";
  recommended_station: StationOffer | null;
}

export interface UserModel {
  fuelType: string;
  tankL: number;
  usualStation: string | null;
  usualStationName: string | null;
  membership: string | null;
  theme: "dark" | "light";
}
