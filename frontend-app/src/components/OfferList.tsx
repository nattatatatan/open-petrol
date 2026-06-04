import { useState } from "react";
import type { Baseline, StationOffer } from "../types";
import { Icon } from "./Icon";
import { FRESHNESS_META, formatCents, formatDistance, formatDollars, formatMinutes } from "../lib/format";

/** Tier-4 alternatives (STYLE_GUIDE §4, §7.5) — a single collapsed affordance, not
 *  a compare grid. Ranked on NET BENEFIT (not raw price). Excludes the winner (it's
 *  the hero card above); the baseline is shown as an anchor row so savings are honest.
 *  Tapping a row makes it the active answer. */
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
  // The winner is the hero card above — don't repeat it here.
  const rest = offers.filter((o) => !o.is_recommended);
  if (rest.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-lg border border-border bg-[color:var(--color-card)] px-md py-3 text-left"
      >
        <span className="text-sm font-medium text-text">
          Other options {mode === "route" ? "on your route" : "nearby"}
          <span className="ml-1 text-text-secondary">({rest.length})</span>
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
          <li className="px-1 pb-1 text-[11px] text-text-secondary">
            Ranked by what you’d save after the fuel + time to drive there.
          </li>
          {rest.map((o) => {
            const fm = FRESHNESS_META[o.freshness];
            const cheaper = o.saving_per_litre > 0;   // beats the baseline at the pump
            const worthIt = o.net_benefit > 0.5;      // nets out ahead after fuel + time
            // The proof line: we show BOTH sides so the verdict is self-evidently true
            // (you save $S on fuel, but the trip costs $D) — never a black-box verdict.
            const proof = `${formatDollars(o.saving_per_tank)} cheaper · ${formatDollars(o.detour_cost)} drive`;
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
                        <Icon
                          name="star"
                          size={12}
                          className="shrink-0 text-[color:var(--color-brand)]"
                          label="Your usual station (savings baseline)"
                        />
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-secondary">
                      <span className="mono">
                        {mode === "route" ? `${formatMinutes(o.detour_min)} detour` : formatDistance(o.distance_km)}
                        {" · "}
                        {formatCents(o.discount > 0 ? o.effective_price : o.price)}c/L
                      </span>
                      {/* Discount is pre-applied (effective price above); the chip is the
                          indicator, never a "−Nc" the user must subtract. Pump price +
                          exact discount stay available in the tooltip (transparency). */}
                      {o.discount > 0 && (
                        <span
                          className="max-w-[92px] shrink-0 truncate rounded-full border border-[color:var(--color-success)]/40 px-1.5 text-[9px] text-[color:var(--color-success)]"
                          title={`Includes ${o.discount_label ?? "member"} −${formatCents(o.discount)}c · pump ${formatCents(o.price)}c`}
                        >
                          {o.discount_label ?? "member"}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* The verdict is the NET outcome (the ranking key), and it shows its
                      work on the line below so it's trustworthy even when the pump price
                      looks cheaper. Distance lives once, on the left. */}
                  <div className="w-[108px] shrink-0 text-right">
                    {!cheaper ? (
                      <>
                        <div className="text-sm font-medium leading-none text-text-secondary">
                          pricier here
                        </div>
                        <div className="mt-1 text-[10px] text-text-secondary">
                          not cheaper than your baseline
                        </div>
                      </>
                    ) : worthIt ? (
                      <>
                        <div
                          className="mono text-sm font-medium leading-none"
                          style={{ color: "var(--saving-positive)" }}
                        >
                          save {formatDollars(o.net_benefit)}
                        </div>
                        <div className="mono mt-1 text-[10px] text-text-secondary">{proof}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-medium leading-none text-text-secondary">
                          {o.net_benefit < -0.5 ? `${formatDollars(-o.net_benefit)} worse` : "about even"}
                        </div>
                        <div className="mono mt-1 text-[10px] text-text-secondary">{proof}</div>
                      </>
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
