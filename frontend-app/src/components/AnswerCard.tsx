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
  ageLabel,
} from "../lib/format";

type LatLng = [number, number];

/** The hero — the whole product (STYLE_GUIDE §4, the Decision-Atom Model).
 *
 *  Hierarchy is encoded in position/colour/weight, not words:
 *   T1 verdict  — station name + the NET-of-detour $ saving (big, GREEN; $-led per
 *                 §7), explicitly labelled with a fuel-saving − detour breakdown so
 *                 the user never re-does the math
 *   T2 cost     — confidence chip + spatial detour (mid-grey, smaller)
 *   T3 proof    — fuel type + the pump price c/L the saving rests on (gold, bumped
 *                 up from a quiet caption since drivers sanity-check on pump price)
 *  Confidence modulates Tier-1 strength: a stale card visibly cools (gold→neutral).
 *  We stay decisive even with no worthwhile detour — we just don't fake a saving.
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
  };
}) {
  // The headline saving is NET of detour in both modes (the truth the user would
  // otherwise have to compute themselves), so we only claim a saving when the pick
  // genuinely nets ahead. Otherwise we stay honest: cheapest/nearest, no faked $.
  const worthwhile = offer.net_benefit > 0.5;
  const fresh = offer.freshness === "fresh";
  const winnerPrice = offer.discount > 0 ? offer.effective_price : offer.price;

  return (
    <section
      aria-label="Recommended station"
      className={`flex flex-col overflow-hidden rounded-xl border bg-[color:var(--color-card)] transition-colors ${
        fresh ? "border-winner" : "border-border"
      }`}
    >
      {/* ── Decision (DOM-first for screen readers; rendered below the map) ── */}
      <div aria-live="polite" className="order-2 px-lg pb-lg pt-md">
        {/* Eyebrow (mono caption) + the ONE gold accent: the winner status pill */}
        <div className="flex items-start justify-between gap-2">
          <p className="cap pt-1 text-text-secondary">
            {mode === "route" ? "Best on your way" : "Cheapest near you"}
          </p>
          <Pill color="var(--color-brand)" className="cap shrink-0">
            {worthwhile ? (mode === "route" ? "Best value" : "Cheapest") : "Nearest"}
          </Pill>
        </div>

        {/* T1 verdict — station (thin display type; the brand signature) */}
        <h2 className="mt-1.5 flex items-start gap-1.5 text-[28px] font-extralight leading-tight tracking-display text-text-heading">
          <Icon name="pin" size={20} className="mt-1.5 text-text-secondary" />
          <span>{offer.name}</span>
        </h2>
        {offer.address && (
          <p className="mono mt-1 pl-[26px] text-xs text-text-secondary">{offer.address}</p>
        )}

        {/* T1 saving — the NET-of-detour dollar saving leads (CLAUDE.md §7: $ is
            instantly evaluable). Explicitly labelled, with the fuel-saving − detour
            breakdown spelled out, so the user never re-does the math (north star:
            the app computes; the UI explains). */}
        <div className="mt-lg">
          {worthwhile ? (
            <>
              <p className="cap text-text-secondary">You save · after detour</p>
              <div className="mt-1.5 flex items-baseline gap-1.5">
                <span className="mono text-[46px] font-light leading-none text-[color:var(--saving-positive)]">
                  +{formatDollars(offer.net_benefit)}
                </span>
                <span className="text-sm font-light text-text-secondary">
                  on a ~{Math.round(tankL)}L fill · vs {baseline.label}
                </span>
              </div>
              {offer.detour_cost >= 0.01 && (
                <p className="cap mt-2 text-text-secondary">
                  fuel saving{" "}
                  <span className="text-[color:var(--saving-positive)]">+{formatDollars(offer.saving_per_tank)}</span>
                  {" · "}detour{" "}
                  <span className="text-[color:var(--detour-cost)]">−{formatDollars(offer.detour_cost)}</span>
                </p>
              )}
            </>
          ) : (
            <p className="text-base text-text">
              {mode === "route" ? "Best value on your way —" : "Your cheapest option nearby —"}{" "}
              <span className="text-text-secondary">
                {mode === "route"
                  ? "nothing further along saves enough to beat the detour."
                  : `nothing nearby beats ${baseline.label}.`}
              </span>
            </p>
          )}
        </div>

        {/* T2 cost of acting — confidence + the spatial detour. The dollar cost of
            that detour lives inside the saving breakdown above, so it's stated once,
            never double-counted. */}
        <div className="mt-md flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-divider-subtle pt-md">
          <ConfidenceChip
            freshness={offer.freshness}
            lastUpdated={offer.last_updated}
            reference={reference}
          />
          <span className="cap text-text-secondary">
            {mode === "route"
              ? `${formatMinutes(offer.detour_min)} detour`
              : `${formatDistance(offer.distance_km)} away`}
          </span>
        </div>

        {offer.freshness !== "fresh" && (
          <p className="mt-2 text-xs text-[color:var(--color-text-alert)]">
            This price is {ageLabel(offer.last_updated, reference)} old — worth confirming at the pump.
          </p>
        )}

        {/* T3 proof — the pump price the saving rests on. Stays below the $ hero,
            but bumped up (larger, gold) since many drivers sanity-check on the pump
            price itself. Fuel type sits beside it (the price is only right for one). */}
        <div className="mt-md flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-divider-subtle pt-md">
          <Pill className="cap border border-border text-text-secondary">{offer.fuel_type}</Pill>
          <div className="flex items-baseline gap-1">
            <span className="mono text-[22px] font-light leading-none text-[color:var(--color-brand)]">
              {formatCents(winnerPrice)}
            </span>
            <span className="mono text-xs font-light text-[color:var(--color-brand)]">c/L</span>
          </div>
          {offer.discount > 0 && (
            <span className="mono text-xs text-text-secondary">
              <span className="line-through opacity-60">{formatCents(offer.price)}c</span>
              {" · "}−{formatCents(offer.discount)}c {offer.discount_label ?? "member"} applied
            </span>
          )}
        </div>

        {/* Close the loop — thumb-zone primary action (dark raised, label left,
            arrow right; no wrap). Set-usual is a compact icon toggle. */}
        <div className="mt-lg flex items-center gap-2">
          <Button className="flex-1 whitespace-nowrap !justify-between" onClick={onNavigate}>
            <span>Navigate {mode === "route" ? "via stop" : "here"}</span>
            <Icon name="navigate" size={18} />
          </Button>
          <Button
            hierarchy="secondary"
            size="small"
            onClick={onSetUsual}
            aria-pressed={isUsual}
            aria-label={
              isUsual
                ? "Your usual station — the savings baseline. Tap to unset."
                : "Set as your usual station — used as your savings baseline"
            }
            title={
              isUsual
                ? "Your usual station — your savings baseline. Tap to unset."
                : "Set as your usual station — your savings baseline"
            }
            className="shrink-0 whitespace-nowrap"
          >
            <Icon
              name="star"
              size={16}
              className={isUsual ? "text-[color:var(--color-brand)]" : "text-text-secondary"}
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
        />
      </div>
    </section>
  );
}
