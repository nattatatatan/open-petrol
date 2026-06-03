import type { Freshness } from "../types";
import { freshnessAge } from "../lib/format";
import { InfoTooltip } from "./ui";

/** Confidence as colour + label + tooltip (STYLE_GUIDE §5.3) — the canonical
 *  "colour is never alone" pattern. The dot/colour is an accelerant; the words
 *  (age in plain language) are the guarantee. Surfaces the PRICE's own
 *  last_updated, not our poll time (CLAUDE.md §4). */
const META: Record<
  Freshness,
  { label: string; color: string; tip: string }
> = {
  fresh: {
    label: "fresh",
    color: "var(--confidence-fresh)",
    tip: "This price was reported by the station recently, so we're confident it's current.",
  },
  ageing: {
    label: "ageing",
    color: "var(--confidence-ageing)",
    tip: "This price is a day or so old. FuelCheck shows what operators submit, so we've eased our confidence — worth a glance at the pump.",
  },
  stale: {
    label: "stale",
    color: "var(--confidence-stale)",
    tip: "This price was last reported by the station a few days ago. Older prices can be wrong at the pump, so we've eased our confidence and suggest confirming when you arrive.",
  },
};

export function ConfidenceChip({
  freshness,
  lastUpdated,
  reference,
}: {
  freshness: Freshness;
  lastUpdated: string;
  reference: string;
}) {
  const m = META[freshness];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-secondary">
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: m.color }}
        aria-hidden
      />
      {m.label} · {freshnessAge(lastUpdated, reference)}
      <InfoTooltip label={`Confidence: ${m.label}`}>{m.tip}</InfoTooltip>
    </span>
  );
}
