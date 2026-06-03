import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Coords } from "../hooks/useGeolocation";
import type { StationHit, UserModel } from "../types";
import { formatDistance } from "../lib/format";
import { Button } from "./ui";

/** Bottom-sheet for the user model: tank size (makes saving-per-fill THEIRS), the
 *  usual-station baseline (set via typeahead — CLAUDE.md §7 thread D), membership
 *  effective pricing (thread A), and theme. */
export function SettingsSheet({
  open,
  model,
  usualStationName,
  discountPrograms,
  coords,
  onUpdate,
  onClose,
}: {
  open: boolean;
  model: UserModel;
  usualStationName: string | null;
  discountPrograms: Record<string, { label: string; note: string }>;
  coords: Coords | null;
  onUpdate: (patch: Partial<UserModel>) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const programs = Object.entries(discountPrograms);
  const activeNote = model.membership ? discountPrograms[model.membership]?.note : null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-[color:var(--color-card)] p-lg pb-[calc(24px+env(safe-area-inset-bottom))]">
        <div className="mx-auto mb-lg h-1 w-10 rounded-full bg-border" />
        <h2 className="mb-lg text-lg font-bold text-text-heading">Your settings</h2>

        <label className="mb-2 block text-sm text-text-secondary">
          Tank size — <span className="mono text-text">{model.tankL} L</span>
        </label>
        <input
          type="range"
          min={30}
          max={110}
          step={5}
          value={model.tankL}
          onChange={(e) => onUpdate({ tankL: Number(e.target.value) })}
          className="mb-lg w-full accent-[color:var(--color-brand)]"
        />

        <div className="mb-lg">
          <div className="mb-1 text-sm text-text-secondary">Savings baseline</div>
          {model.usualStation ? (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">
                Usual: <span className="font-medium text-text">{model.usualStationName ?? usualStationName ?? model.usualStation}</span>
              </span>
              <button
                className="text-xs text-text-action hover:underline"
                onClick={() => onUpdate({ usualStation: null, usualStationName: null })}
              >
                Clear
              </button>
            </div>
          ) : (
            <>
              <p className="mb-2 text-xs text-text-secondary">
                Compared against the <span className="text-text">area average</span> until you
                pick your regular station — then savings are anchored to what you’d normally pay.
              </p>
              <UsualStationSearch
                coords={coords}
                onPick={(s) => onUpdate({ usualStation: s.code, usualStationName: s.name })}
              />
            </>
          )}
        </div>

        {programs.length > 0 && (
          <div className="mb-lg">
            <div className="mb-1 text-sm text-text-secondary">Membership / fuel discount</div>
            <p className="mb-2 text-xs text-text-secondary">
              We’ll rank on your <span className="text-text">effective price</span> — a 4–5c/L
              card can beat the pump-cheapest station.
            </p>
            <div className="flex flex-wrap gap-2">
              <Chip
                active={!model.membership}
                onClick={() => onUpdate({ membership: null })}
                label="None"
              />
              {programs.map(([key, p]) => (
                <Chip
                  key={key}
                  active={model.membership === key}
                  onClick={() => onUpdate({ membership: key })}
                  label={p.label}
                />
              ))}
            </div>
            {activeNote && (
              <p className="mt-2 text-xs text-text-secondary">{activeNote}</p>
            )}
          </div>
        )}

        <div className="mb-xl flex items-center justify-between">
          <span className="text-sm text-text-secondary">Theme</span>
          <div className="flex gap-2">
            {(["dark", "light"] as const).map((t) => (
              <button
                key={t}
                onClick={() => onUpdate({ theme: t })}
                className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
                  model.theme === t
                    ? "border-brand text-text-action"
                    : "border-border text-text-secondary"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <Button className="w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1.5 text-xs ${
        active ? "border-brand text-text-action" : "border-border text-text-secondary"
      }`}
    >
      {label}
    </button>
  );
}

/** Typeahead to anchor the baseline to a regular station without first running a
 *  search and tapping it in the results (CLAUDE.md §7). Nearest matches first. */
function UsualStationSearch({
  coords,
  onPick,
}: {
  coords: Coords | null;
  onPick: (s: StationHit) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StationHit[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .searchStations({ q: query, lat: coords?.lat, lng: coords?.lng })
        .then((res) => id === seq.current && setHits(res))
        .catch(() => id === seq.current && setHits([]))
        .finally(() => id === seq.current && setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, coords]);

  return (
    <div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search your usual station…"
        className="w-full rounded-md border border-border bg-[color:var(--color-card-raised)] px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:border-border-strong focus:outline-none"
      />
      {q.trim().length >= 2 && (
        <ul className="mt-2 max-h-48 overflow-y-auto rounded-md border border-border">
          {hits.map((s) => (
            <li key={s.code}>
              <button
                onClick={() => onPick(s)}
                className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-[color:var(--color-card-raised)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-text">{s.name}</span>
                  {s.address && (
                    <span className="block truncate text-xs text-text-secondary">{s.address}</span>
                  )}
                </span>
                {s.distance_km !== null && (
                  <span className="shrink-0 text-xs text-text-secondary">
                    {formatDistance(s.distance_km)}
                  </span>
                )}
              </button>
            </li>
          ))}
          {!loading && hits.length === 0 && (
            <li className="px-3 py-2 text-xs text-text-secondary">No matches.</li>
          )}
        </ul>
      )}
    </div>
  );
}
