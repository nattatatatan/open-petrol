import type { Freshness } from "../types";

/** FuelCheck prices are cents/L, e.g. 184.9 → "184.9". */
export const formatCents = (c: number) => c.toFixed(1);

export const formatDollars = (d: number) => {
  const sign = d < 0 ? "-" : "";
  return `${sign}$${Math.abs(d).toFixed(2)}`;
};

export const formatDistance = (km: number) =>
  km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;

export const formatMinutes = (min: number | null) =>
  min === null ? "" : `+${Math.round(min)} min`;

export function freshnessAge(lastUpdated: string, reference: string): string {
  const ms = new Date(reference).getTime() - new Date(lastUpdated).getTime();
  const hrs = ms / 3_600_000;
  if (hrs < 1) return `${Math.max(1, Math.round(hrs * 60))} min ago`;
  if (hrs < 24) return `${Math.round(hrs)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

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
