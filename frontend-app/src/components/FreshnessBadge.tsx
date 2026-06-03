import type { Freshness } from "../types";
import { FRESHNESS_META, freshnessAge } from "../lib/format";
import { Pill } from "./ui";

/** Per-price freshness (CLAUDE.md §4) — surfaces the PRICE's own last_updated,
 *  not our fetch time. A dot + age, coloured by staleness. */
export function FreshnessBadge({
  freshness,
  lastUpdated,
  reference,
}: {
  freshness: Freshness;
  lastUpdated: string;
  reference: string;
}) {
  const meta = FRESHNESS_META[freshness];
  return (
    <Pill color={meta.color}>
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: meta.color }}
        aria-hidden
      />
      {meta.label} · {freshnessAge(lastUpdated, reference)}
    </Pill>
  );
}
