import type { Baseline, StationOffer } from "../types";
import { Button, Pill } from "./ui";
import { Icon } from "./Icon";
import { ConfidenceChip } from "./ConfidenceChip";
import { MapStrip } from "./MapStrip";
import {
  formatCents,
  formatDistance,
  formatDollars,
  formatMinutes,
  freshnessAge,
} from "../lib/format";

type LatLng = [number, number];

/** The hero — the whole product (STYLE_GUIDE §4, the Decision-Atom Model).
 *
 *  Hierarchy is encoded in position/colour/weight, not words:
 *   T1 verdict  — station name (gold-marked winner) + the saving (big, GREEN, c/L leads)
 *   T2 cost     — confidence chip + detour + cost-to-get-there (mid-grey, smaller)
 *   T3 proof    — pump price c/L + baseline (quiet DM Mono)
 *  One gold element (the winner), one green number (the saving). Confidence
 *  modulates Tier-1 strength: a stale card visibly cools (gold→neutral). We stay
 *  decisive even with no worthwhile detour — we just don't fake a saving.
 *
 *  DOM order is decision-first (§11): verdict→saving→confidence→proof→Navigate,
 *  with the map placed last in DOM but first visually (CSS order). */
export function AnswerCard({
  offer,
  baseline,
  mode,
  tankL,
  reference,
  isUsual,
  onNavigate,
  onSetUsual,
  map,
}: {
  offer: StationOffer;
  baseline: Baseline;
  mode: "route" | "near";
  tankL: number;
  reference: string;
  isUsual: boolean;
  onNavigate: () => void;
  onSetUsual: () => void;
  map: {
    offers: StationOffer[];
    origin: LatLng | null;
    destination: LatLng | null;
    route: LatLng[];
    theme: "dark" | "light";
  };
}) {
  const worthwhile = offer.net_benefit > 0.5;
  const fresh = offer.freshness === "fresh";
  const winnerPrice = offer.discount > 0 ? offer.effective_price : offer.price;

  return (
    <section
      aria-label="Recommended station"
      className={`flex flex-col overflow-hidden rounded-lg border bg-[color:var(--color-card)] transition-colors ${
        fresh ? "border-winner" : "border-border"
      }`}
    >
      {/* ── Decision (DOM-first for screen readers; rendered below the map) ── */}
      <div aria-live="polite" className="order-2 px-lg pb-lg pt-md">
        {/* T1 verdict — station */}
        <p
          className={`text-xs font-semibold uppercase tracking-display ${
            fresh ? "text-text-action" : "text-text-secondary"
          }`}
        >
          {mode === "route" ? "Best value on your way" : "Cheapest near you"}
        </p>
        <h2 className="mt-1 flex items-start gap-1.5 text-2xl font-medium leading-tight text-text-heading">
          <Icon
            name="pin"
            size={20}
            className={`mt-0.5 ${fresh ? "text-[color:var(--decision-winner)]" : "text-text-secondary"}`}
          />
          <span>{offer.name}</span>
        </h2>
        {offer.address && (
          <p className="mt-0.5 pl-[26px] text-sm text-text-secondary">{offer.address}</p>
        )}

        {/* T1 verdict — saving (the big GREEN number; c/L leads, $ is an estimate) */}
        <div className="mt-md">
          {worthwhile ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="mono text-[40px] font-medium leading-none text-[color:var(--saving-positive)]">
                  {formatCents(offer.saving_per_litre)}
                  <span className="text-xl">c/L</span>
                </span>
                <span className="text-base text-text">cheaper</span>
              </div>
              <p className="mt-1 text-sm text-text-secondary">
                ≈ {formatDollars(offer.saving_per_tank)} off a ~{Math.round(tankL)}L fill ·
                vs {baseline.label}
              </p>
            </>
          ) : (
            <p className="text-base text-text">
              Your cheapest convenient option —{" "}
              <span className="text-text-secondary">no detour worth the drive vs {baseline.label}.</span>
            </p>
          )}
        </div>

        {/* T2 cost of acting — confidence + detour */}
        <div className="mt-md flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <ConfidenceChip
            freshness={offer.freshness}
            lastUpdated={offer.last_updated}
            reference={reference}
          />
          <span className="text-[color:var(--detour-cost)]">
            {mode === "route"
              ? `${formatMinutes(offer.detour_min)} detour`
              : `${formatDistance(offer.distance_km)} away`}
            {" · "}
            {formatDollars(offer.detour_cost)} to get there
          </span>
        </div>

        {offer.freshness !== "fresh" && (
          <p className="mt-2 text-xs text-[color:var(--color-text-alert)]">
            This price is {freshnessAge(offer.last_updated, reference)} old — worth confirming at the pump.
          </p>
        )}

        {/* T3 proof — pump price (quiet), demoted from hero to evidence */}
        <div className="mt-md flex items-center gap-2 border-t border-divider-subtle pt-md text-sm text-text-secondary">
          <Pill className="border border-border text-text-secondary">{offer.fuel_type}</Pill>
          <span className="mono">
            {formatCents(winnerPrice)}c/L
            {offer.discount > 0 && (
              <>
                {" "}
                <span className="line-through opacity-60">{formatCents(offer.price)}</span>{" "}
                <span className="text-text-action">−{formatCents(offer.discount)}c {offer.discount_label ?? "member"}</span>
              </>
            )}
          </span>
        </div>

        {/* Close the loop — thumb-zone primary action */}
        <div className="mt-lg flex items-center gap-3">
          <Button className="flex-1" onClick={onNavigate}>
            <Icon name="navigate" size={18} />
            Navigate {mode === "route" ? "via this stop" : "here"}
          </Button>
          <Button
            hierarchy="secondary"
            size="small"
            onClick={onSetUsual}
            aria-pressed={isUsual}
          >
            <Icon
              name="star"
              size={15}
              className={isUsual ? "text-[color:var(--color-brand)]" : ""}
            />
            {isUsual ? "Usual" : "Set usual"}
          </Button>
        </div>
      </div>

      {/* Tier-2 map context — visually first (order-1), DOM-last for SR order */}
      <div className="order-1">
        <MapStrip
          offers={map.offers}
          origin={map.origin}
          destination={map.destination}
          route={map.route}
          theme={map.theme}
        />
      </div>
    </section>
  );
}
