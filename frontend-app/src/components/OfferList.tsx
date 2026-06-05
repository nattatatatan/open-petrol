import { useState } from "react";
import type { Baseline, StationOffer } from "../types";
import { Icon } from "./Icon";
import { FRESHNESS_META, formatApproxDollars, formatCents, formatDistance, formatDollars, formatMinutes } from "../lib/format";

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
  // Which row has its saving-vs-drive math revealed (tap, not hover — touch context).
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  // The winner is the hero card above — don't repeat it here.
  const rest = offers.filter((o) => !o.is_recommended);
  if (rest.length === 0) return null;

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between rounded-md border border-border bg-[color:var(--color-card)] px-4 py-4 text-left backdrop-blur-[24px]"
      >
        <span className="text-base font-light text-text">
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
            const expanded = expandedRow === o.station_code;
            return (
              <li key={o.station_code}>
                <div className={`flex items-stretch rounded-lg border bg-black transition-colors ${expanded ? "border-border-strong" : "border-border"}`}>
                  {/* Left zone — selects this station as the active answer */}
                  <button
                    onClick={() => onSelect(o)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-l-lg px-3 py-3 text-left transition-colors hover:bg-white/5"
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: fm.color }}
                      title={fm.label}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-sm font-normal text-text">{o.name}</span>
                        {usualStation === o.station_code && (
                          <Icon
                            name="star"
                            size={12}
                            className="shrink-0 text-[color:var(--color-brand)]"
                            label="Your usual station (savings baseline)"
                          />
                        )}
                      </div>
                      <div className="mt-0.5 flex min-w-0 items-center gap-2">
                        {/* Pump price leads — gold + heavier so it's the first number
                            scanned in the row (many drivers choose on pump price). */}
                        <span className="mono shrink-0 text-[15px] font-medium leading-none text-[color:var(--color-brand)]">
                          {formatCents(o.discount > 0 ? o.effective_price : o.price)}
                          <span className="text-[10px] font-normal">c/L</span>
                        </span>
                        <span className="mono min-w-0 flex-1 truncate text-[11px] text-text-secondary">
                          {mode === "route" ? `${formatMinutes(o.detour_min)} detour` : formatDistance(o.distance_km)}
                          {worthIt
                            ? ` · ${formatCents(o.saving_per_litre)}c/L cheaper`
                            : cheaper
                              ? ` · ${formatApproxDollars(o.detour_cost)} to drive there`
                              : ""}
                        </span>
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
                  </button>

                  {/* Right zone — verdict + chevron; tapping expands the math breakdown */}
                  {cheaper ? (
                    <button
                      onClick={() => setExpandedRow((c) => (c === o.station_code ? null : o.station_code))}
                      aria-expanded={expanded}
                      aria-label="Show saving vs drive breakdown"
                      className="relative flex w-24 shrink-0 items-center justify-center rounded-r-lg border-l border-border px-3 py-3 transition-colors hover:bg-white/5"
                    >
                      {worthIt ? (
                        <span className="mono text-center text-sm font-medium" style={{ color: "var(--saving-positive)" }}>
                          save {formatDollars(o.net_benefit)}
                        </span>
                      ) : (
                        <span className="text-center text-sm font-medium text-text-secondary">
                          {o.net_benefit < -0.5 ? `${formatDollars(-o.net_benefit)} worse` : "about even"}
                        </span>
                      )}
                      <span
                        className={`absolute bottom-2 right-2.5 inline-block text-[11px] font-bold leading-none transition-transform ${expanded ? "rotate-180" : ""} ${expanded ? "text-text" : "text-text-secondary"}`}
                      >
                        ^
                      </span>
                    </button>
                  ) : (
                    <div className="flex w-24 shrink-0 items-center justify-center border-l border-border px-3">
                      <span className="text-center text-sm font-medium text-text-secondary">pricier here</span>
                    </div>
                  )}
                </div>
                {/* The math, made plain: saving at the pump minus the cost to fetch it. */}
                {expanded && cheaper && (
                  <div className="mono mt-1 rounded-lg border border-divider-subtle bg-black px-3 py-2.5 text-[11px] text-text-secondary">
                    <div className="flex items-center justify-between">
                      <span>cheaper at the pump</span>
                      <span className="text-text">{formatDollars(o.saving_per_tank)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span>− fuel + time to drive there</span>
                      <span className="text-[color:var(--detour-cost)]">{formatDollars(o.detour_cost)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-divider-subtle pt-2">
                      <span>= net</span>
                      <span
                        className="font-medium"
                        style={{ color: worthIt ? "var(--saving-positive)" : undefined }}
                      >
                        {formatDollars(o.net_benefit)}
                      </span>
                    </div>
                  </div>
                )}
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
