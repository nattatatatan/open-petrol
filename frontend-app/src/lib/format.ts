import type { Freshness } from "../types";

/** FuelCheck prices are cents/L, e.g. 184.9 → "184.9". */
export const formatCents = (c: number) => c.toFixed(1);

export const formatDollars = (d: number) => {
  const sign = d < 0 ? "-" : "";
  const abs = Math.abs(d);
  const fixed = abs.toFixed(2);
  return `${sign}$${fixed.endsWith(".00") ? Math.round(abs) : fixed}`;
};

/** Casual, visibly-rounded figure for an inline cost-to-act ("~$5", "~$0.86").
 *  Whole dollars once ≥ $1; cents below. Distinct from formatDollars (exact),
 *  which carries the precise verdict and the saved − drive = net breakdown. */
export const formatApproxDollars = (d: number) => {
  const abs = Math.abs(d);
  return abs >= 1 ? `~$${Math.round(abs)}` : `~$${abs.toFixed(2)}`;
};

export const formatDistance = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export const formatMinutes = (min: number | null) =>
  min === null ? "" : `+${Math.round(min)} min`;

/** Bare age, no "ago" — for inline sentences like "this price is 5h old". */
export function ageLabel(lastUpdated: string, reference: string): string {
  const ms = new Date(reference).getTime() - new Date(lastUpdated).getTime();
  const hrs = ms / 3_600_000;
  if (hrs < 1) return `${Math.max(1, Math.round(hrs * 60))} min`;
  if (hrs < 24) return `${Math.round(hrs)}h`;
  return `${Math.round(hrs / 24)}d`;
}

export const freshnessAge = (lastUpdated: string, reference: string): string =>
  `${ageLabel(lastUpdated, reference)} ago`;

export function relativeFromNow(iso: string | null): string {
  if (!iso) return "—";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : `${Math.round(hrs / 24)}d ago`;
}

export const FRESHNESS_META: Record<Freshness, { label: string; color: string }> = {
  fresh: { label: "Fresh", color: "var(--color-success)" },
  ageing: { label: "Ageing", color: "var(--color-warning)" },
  stale: { label: "Stale", color: "var(--color-accent)" },
};
