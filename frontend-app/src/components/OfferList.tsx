import { useState } from "react";
import type { Baseline, StationOffer } from "../types";
import { Icon } from "./Icon";
import { FRESHNESS_META, formatCents, formatDistance, formatDollars, formatMinutes } from "../lib/format";

/** Tier-4 alternatives (STYLE_GUIDE §4, §7.5) — a single collapsed affordance, not
 *  a compare grid. Ranked on NET BENEFIT (not raw price). The winner is repeated at
 *  top (gold), the baseline is shown as an anchor row so savings are honest. Tapping
 *  a row makes it the active answer. */
export function OfferList({
  offers,
  baseline,
  mode,
  usualStation,
  onSelect,
}: {
  offers: StationOffer[];
  baseline: Baseline;
  mode: "route" | "near";
  usualStation: string | null;
  onSelect: (o: StationOffer) => void;
}) {
  const [open, setOpen] = useState(false);
  if (offers.length <= 1) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-[color:var(--color-card)] px-md py-3 text-left"
      >
        <span className="text-sm font-medium text-text">
          Other options {mode === "route" ? "on your route" : "nearby"}
          <span className="ml-1 text-text-secondary">({offers.length})</span>
        </span>
        <Icon
          name="arrow"
          size={14}
          rotate={open ? 180 : 90}
          className="text-text-secondary"
        />
      </button>

      {open && (
        <ul className="mt-2 space-y-2">
          {offers.map((o) => {
            const fm = FRESHNESS_META[o.freshness];
            const positive = o.net_benefit > 0.5;
            return (
              <li key={o.station_code}>
                <button
                  onClick={() => onSelect(o)}
                  className={`flex w-full items-center gap-3 rounded-lg border bg-[color:var(--color-card)] px-3 py-3 text-left transition-colors hover:border-border-strong ${
                    o.is_recommended ? "border-winner" : "border-border"
                  }`}
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
                        <Icon
                          name="star"
                          size={12}
                          className="shrink-0 text-[color:var(--color-brand)]"
                          label="Your usual station (savings baseline)"
                        />
                      )}
                    </div>
                    <div className="mono mt-0.5 text-[11px] text-text-secondary">
                      {mode === "route" ? `${formatMinutes(o.detour_min)} detour` : formatDistance(o.distance_km)}
                      {" · "}
                      {formatCents(o.discount > 0 ? o.effective_price : o.price)}c/L
                      {o.discount > 0 && <span className="ml-1">−{formatCents(o.discount)}</span>}
                    </div>
                  </div>
                  {/* Mirror the hero: lead with c/L cheaper (green), $/fill as the
                      quiet estimate. Same units as the AnswerCard so the winner's
                      figures match its row. Ranked net-of-detour (the order). */}
                  <div
                    className="shrink-0 text-right"
                    title={
                      positive
                        ? "Cheaper per litre vs your baseline — ranked net of the detour to get there"
                        : "The detour costs more than you'd save vs your baseline"
                    }
                  >
                    {positive ? (
                      <>
                        <div
                          className="mono text-sm font-medium leading-none"
                          style={{ color: "var(--saving-positive)" }}
                        >
                          {formatCents(o.saving_per_litre)}
                          <span className="text-xs">c/L</span>
                        </div>
                        <div className="mono mt-1 text-[10px] text-text-secondary">
                          ≈ {formatDollars(o.saving_per_tank)}
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-text-secondary">not worth the drive</span>
                    )}
                  </div>
                </button>
              </li>
            );
          })}

          {/* Baseline anchor — what "saving" is measured against (§7, §7.5). */}
          <li className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-text-secondary">
            <span>{baseline.label}</span>
            <span className="mono">{formatCents(baseline.price)}c/L · base</span>
          </li>
        </ul>
      )}
    </div>
  );
}
