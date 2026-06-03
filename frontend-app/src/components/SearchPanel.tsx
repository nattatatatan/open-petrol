import { useState } from "react";
import type { GeoStatus } from "../hooks/useGeolocation";
import { Button } from "./ui";

type Mode = "route" | "near";

/** Two entry points (CLAUDE.md §7.5): "On my way" is primary (drivers fill up
 *  along a route they're already driving); "Near me now" is the low-tank case. */
export function SearchPanel({
  mode,
  onModeChange,
  geoStatus,
  originLabel,
  onUseLocation,
  onManualOrigin,
  destination,
  onDestinationChange,
  onSearch,
  loading,
}: {
  mode: Mode;
  onModeChange: (m: Mode) => void;
  geoStatus: GeoStatus;
  originLabel: string | null;
  onUseLocation: () => void;
  onManualOrigin: (q: string) => void;
  destination: string;
  onDestinationChange: (v: string) => void;
  onSearch: () => void;
  loading: boolean;
}) {
  const [manual, setManual] = useState("");
  const needsManual = geoStatus === "denied" || geoStatus === "unavailable";
  const haveOrigin = !!originLabel;

  return (
    <div className="space-y-md">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-border p-1">
        {([
          ["route", "On my way"],
          ["near", "Near me now"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => onModeChange(m)}
            className={`rounded-full py-2 text-sm font-semibold transition-colors ${
              mode === m
                ? "bg-brand text-[color:var(--color-text-onAction)]"
                : "text-text-secondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Origin */}
      {haveOrigin ? (
        <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm">
          <span className="inline-flex items-center gap-2 text-text">
            <span className="h-2 w-2 rounded-full bg-[color:var(--color-success)]" />
            {originLabel}
          </span>
          <button className="text-xs text-text-action hover:underline" onClick={onUseLocation}>
            Update
          </button>
        </div>
      ) : needsManual ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) onManualOrigin(manual.trim());
          }}
        >
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Enter your suburb"
            className="flex-1 rounded-md border border-border bg-transparent px-3 py-2.5 text-sm text-text placeholder:text-text-secondary focus:border-border-strong focus:outline-none"
          />
          <Button hierarchy="secondary" size="small" type="submit">Set</Button>
        </form>
      ) : (
        <Button
          hierarchy="secondary"
          className="w-full"
          onClick={onUseLocation}
          loading={geoStatus === "locating"}
        >
          📍 Use my location
        </Button>
      )}

      {/* Destination (route mode only) */}
      {mode === "route" && (
        <input
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && haveOrigin && destination.trim() && onSearch()}
          placeholder="Where are you headed? (e.g. Parramatta)"
          className="w-full rounded-md border border-border bg-transparent px-3 py-3 text-text placeholder:text-text-secondary focus:border-border-strong focus:outline-none"
        />
      )}

      <Button
        className="w-full"
        onClick={onSearch}
        disabled={!haveOrigin || (mode === "route" && !destination.trim())}
        loading={loading}
      >
        {loading ? (
          <>Finding the best fill-up…</>
        ) : mode === "route" ? (
          "Find my fill-up on the way"
        ) : (
          "Find cheapest near me"
        )}
      </Button>
    </div>
  );
}
