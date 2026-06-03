import type { Baseline, StationOffer } from "../types";
import { Button, Pill } from "./ui";
import { FreshnessBadge } from "./FreshnessBadge";
import {
  formatCents,
  formatDistance,
  formatDollars,
  formatMinutes,
  freshnessAge,
} from "../lib/format";

/** The answer, visually dominant — "one glance, one action" (CLAUDE.md §8).
 *  Honest when no detour is worthwhile: we don't fake a saving. */
export function ResultHero({
  offer,
  baseline,
  mode,
  tankL,
  reference,
  isUsual,
  onNavigate,
  onSetUsual,
}: {
  offer: StationOffer;
  baseline: Baseline;
  mode: "route" | "near";
  tankL: number;
  reference: string;
  isUsual: boolean;
  onNavigate: () => void;
  onSetUsual: () => void;
}) {
  const worthwhile = offer.net_benefit > 0.5;
  const saving = offer.saving_per_tank;

  return (
    <section className="overflow-hidden rounded-lg border border-brand bg-[color:var(--color-card)]">
      <div className="bg-brand/10 px-lg pt-lg">
        <p className="text-xs font-semibold uppercase tracking-display text-text-action">
          {mode === "route" ? "Best value on your way" : "Cheapest near you"}
        </p>
        <h2 className="mt-1 text-2xl font-bold leading-tight text-text-heading">
          {offer.name}
        </h2>
        {offer.address && (
          <p className="mt-0.5 text-sm text-text-secondary">{offer.address}</p>
        )}
      </div>

      <div className="flex items-end justify-between px-lg pt-md">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="mono text-[44px] font-medium leading-none text-text-heading">
              {formatCents(offer.discount > 0 ? offer.effective_price : offer.price)}
            </span>
            <span className="mono text-base text-text-secondary">c/L</span>
          </div>
          {offer.discount > 0 && (
            <p className="mt-1 text-xs text-text-secondary">
              <span className="mono line-through">{formatCents(offer.price)}</span> pump · −
              {formatCents(offer.discount)}c {offer.discount_label ?? "member"}
            </p>
          )}
          <Pill className="mt-2 border border-border text-text-secondary">
            {offer.fuel_type}
          </Pill>
        </div>
        <div className="text-right">
          {worthwhile ? (
            <>
              <div className="mono text-[28px] font-medium leading-none text-[color:var(--color-success)]">
                {formatCents(offer.saving_per_litre)}
                <span className="text-base">c/L</span>
              </div>
              <div className="text-xs text-text-secondary">
                cheaper · ≈ {formatDollars(saving)} off a ~{Math.round(tankL)}L fill
              </div>
            </>
          ) : (
            <div className="max-w-[150px] text-sm text-text-secondary">
              No worthwhile detour — your cheapest convenient option
            </div>
          )}
        </div>
      </div>

      <div className="mt-md flex flex-wrap items-center gap-x-4 gap-y-2 px-lg text-sm text-text-secondary">
        {mode === "route" ? (
          <span className="text-text">{formatMinutes(offer.detour_min)} detour</span>
        ) : (
          <span className="text-text">{formatDistance(offer.distance_km)} away</span>
        )}
        <span>·</span>
        <span>{formatDollars(offer.detour_cost)} to get there</span>
        <FreshnessBadge
          freshness={offer.freshness}
          lastUpdated={offer.last_updated}
          reference={reference}
        />
      </div>

      {offer.freshness !== "fresh" && (
        <p className="mt-2 px-lg text-xs text-[color:var(--color-text-alert)]">
          This price is {freshnessAge(offer.last_updated, reference)} old — worth
          confirming at the pump.
        </p>
      )}

      <p className="mt-2 px-lg text-xs text-text-secondary">
        {worthwhile ? "Saving" : "Compared"} vs {baseline.label} ({formatCents(baseline.price)}c/L)
      </p>

      <div className="mt-lg flex items-center gap-3 px-lg pb-lg">
        <Button className="flex-1" onClick={onNavigate}>
          Navigate {mode === "route" ? "via this stop" : "here"} →
        </Button>
        <Button
          hierarchy="secondary"
          size="small"
          onClick={onSetUsual}
          aria-pressed={isUsual}
        >
          {isUsual ? "★ Usual" : "Set usual"}
        </Button>
      </div>
    </section>
  );
}
