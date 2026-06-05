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
  discount_label: string | null;
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

export interface CatalogPreset {
  key: string;
  label: string;
  brands: string[];
  cents: number;
  premium: number | null;
}

export interface CustomRule {
  brand: string;
  cents: number;
}

/** Output of the deterministic cycle classifier (backend engine/cycle.py). The
 *  verdict modifies the finder's recommendation; `basis` quotes the real numbers
 *  it was computed from (the trust mechanism). No LLM — see CLAUDE.md §6. */
export type Verdict = "fill_now" | "fill_only_needed" | "wait" | "uncertain";

export interface AdvisorResult {
  verdict: Verdict;
  headline: string;
  detail: string;
  basis: string;
  confidence: number; // 0..1
  expected_saving_per_tank: number | null;
  recommended_station: { name: string; price: number } | null;
}

export interface UserModel {
  fuelType: string;
  /** Has the user explicitly confirmed their fuel? Gates the one-time first-run
   *  chooser (STYLE_GUIDE §7.2) — showing the wrong fuel's saving is unsafe. */
  fuelChosen: boolean;
  tankL: number;
  usualStation: string | null;
  usualStationName: string | null;
  memberships: string[];
  rateOverrides: Record<string, number>;
  customRules: CustomRule[];
}
