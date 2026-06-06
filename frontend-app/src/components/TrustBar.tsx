import type { Meta } from "../types";
import { relativeFromNow } from "../lib/format";

/** Provenance + data-freshness, stamped everywhere (CLAUDE.md §4). If the last
 *  scheduled refresh failed we say so plainly rather than pretending it's live. */
export function TrustBar({ meta }: { meta: Meta | null }) {
  if (!meta) return null;
  return (
    <div className="space-y-2">
      {meta.stale_refresh && (
        <div className="rounded-md border border-[color:var(--color-accent)] bg-[color:color-mix(in_srgb,var(--color-accent)_14%,transparent)] px-3 py-2 text-xs text-[color:var(--color-text-alert)]">
          Live refresh is having trouble — showing the last good prices from{" "}
          {relativeFromNow(meta.last_success_at)}.
        </div>
      )}
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        <span className="inline-flex shrink-0 items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--color-success)]" />
          {meta.station_count} stations
        </span>
        <span className="min-w-0 truncate">· {meta.provider}{meta.source === "snapshot" ? " (snapshot)" : ""}</span>
        <span className="ml-auto shrink-0">prices as of {relativeFromNow(meta.captured_at)}</span>
      </div>
    </div>
  );
}
