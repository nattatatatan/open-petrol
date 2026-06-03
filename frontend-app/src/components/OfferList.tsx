import type { StationOffer } from "../types";
import { FRESHNESS_META, formatCents, formatDistance, formatDollars, formatMinutes } from "../lib/format";

/** The comparison list — secondary to the hero (CLAUDE.md §8). Shows the
 *  underlying prices so the recommendation is transparent, not magic. */
export function OfferList({
  offers,
  mode,
  usualStation,
  onSelect,
}: {
  offers: StationOffer[];
  mode: "route" | "near";
  usualStation: string | null;
  onSelect: (o: StationOffer) => void;
}) {
  if (offers.length <= 1) return null;
  const rest = offers.filter((o) => !o.is_recommended);
  if (rest.length === 0) return null;

  return (
    <div>
      <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-display text-text-secondary">
        {mode === "route" ? "Other options on your route" : "Other options nearby"}
      </h3>
      <ul className="space-y-2">
        {rest.map((o) => {
          const fm = FRESHNESS_META[o.freshness];
          const positive = o.net_benefit > 0.5;
          return (
            <li key={o.station_code}>
              <button
                onClick={() => onSelect(o)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-[color:var(--color-card)] px-3 py-3 text-left transition-colors hover:border-border-strong"
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: fm.color }}
                  title={fm.label}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-text">{o.name}</span>
                    {usualStation === o.station_code && (
                      <span className="text-xs text-text-action">★</span>
                    )}
                  </div>
                  <div className="text-xs text-text-secondary">
                    {mode === "route"
                      ? `${formatMinutes(o.detour_min)} detour`
                      : formatDistance(o.distance_km)}
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="mono text-sm text-text"
                    title={o.discount > 0 ? `${formatCents(o.price)}c pump − ${formatCents(o.discount)}c member` : undefined}
                  >
                    {formatCents(o.discount > 0 ? o.effective_price : o.price)}
                    <span className="text-text-secondary">c</span>
                    {o.discount > 0 && (
                      <span className="ml-1 text-[10px] text-text-action">−{formatCents(o.discount)}</span>
                    )}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: positive ? "var(--color-success)" : "var(--color-text-bodySecondary)" }}
                    title="Net saving after the fuel + time cost of the detour"
                  >
                    {positive ? `net ${formatDollars(o.net_benefit)}` : "after detour —"}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
