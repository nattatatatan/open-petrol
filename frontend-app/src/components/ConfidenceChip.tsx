import { useState } from "react";
import type { Freshness } from "../types";
import { FRESHNESS_META, freshnessAge } from "../lib/format";

/** Confidence as colour + label + tooltip (STYLE_GUIDE §5.3) — the canonical
 *  "colour is never alone" pattern. The whole chip is the tap target (≥44px) so
 *  the explanation is reachable without hunting a 16px icon. The dot uses the
 *  freshness ramp (green→amber→coral), never gold. Surfaces the PRICE's own
 *  last_updated, not our poll time (CLAUDE.md §4). */
const TIP: Record<Freshness, string> = {
  fresh: "This price was reported by the station recently, so we're confident it's current.",
  ageing:
    "This price is a day or so old. FuelCheck shows what operators submit, so we've eased our confidence — worth a glance at the pump.",
  stale:
    "This price was last reported by the station a few days ago. Older prices can be wrong at the pump, so we've eased our confidence and suggest confirming when you arrive.",
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
  const [open, setOpen] = useState(false);
  const m = FRESHNESS_META[freshness];

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={`Confidence: ${m.label}. Tap for detail.`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex min-h-[44px] items-center gap-1.5 text-text-secondary"
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: m.color }}
          aria-hidden
        />
        <span className="cap">{m.label} · {freshnessAge(lastUpdated, reference)}</span>
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px]"
        >
          i
        </span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-11 z-10 w-60 rounded-lg border border-border bg-[color:var(--color-card-raised)] px-3 py-2 text-xs font-normal text-text-secondary"
        >
          {TIP[freshness]}
        </span>
      )}
    </span>
  );
}
