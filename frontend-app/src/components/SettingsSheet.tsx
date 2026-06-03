import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Coords } from "../hooks/useGeolocation";
import type { CatalogPreset, StationHit, UserModel } from "../types";
import { formatDistance } from "../lib/format";
import { Button, InfoTooltip } from "./ui";

const PREMIUM_FUELS = ["P95", "P98"];

/** Bottom-sheet for the user model: tank size (makes saving-per-fill THEIRS), the
 *  usual-station baseline (set via typeahead — CLAUDE.md §7 thread D), membership
 *  effective pricing (thread A), and theme. */
export function SettingsSheet({
  open,
  model,
  usualStationName,
  catalog,
  coords,
  onUpdate,
  onClose,
}: {
  open: boolean;
  model: UserModel;
  usualStationName: string | null;
  catalog: CatalogPreset[];
  coords: Coords | null;
  onUpdate: (patch: Partial<UserModel>) => void;
  onClose: () => void;
}) {
  if (!open) return null;

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

        {catalog.length > 0 && (
          <MembershipPicker
            catalog={catalog}
            fuelType={model.fuelType}
            memberships={model.memberships}
            rateOverrides={model.rateOverrides}
            customRules={model.customRules}
            onUpdate={onUpdate}
          />
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

/** Multi-select cards + editable rate + custom rule (CLAUDE.md §7 thread A). The
 *  user owns the numbers — we apply the single best discount per station, no
 *  stacking. Auto-applied at fill time; zero taps when driving. */
function MembershipPicker({
  catalog,
  fuelType,
  memberships,
  rateOverrides,
  customRules,
  onUpdate,
}: {
  catalog: CatalogPreset[];
  fuelType: string;
  memberships: string[];
  rateOverrides: Record<string, number>;
  customRules: { brand: string; cents: number }[];
  onUpdate: (patch: Partial<UserModel>) => void;
}) {
  const defaultRate = (p: CatalogPreset) =>
    p.premium != null && PREMIUM_FUELS.includes(fuelType) ? p.premium : p.cents;

  const toggle = (key: string) => {
    if (memberships.includes(key)) {
      const rest = { ...rateOverrides };
      delete rest[key];
      onUpdate({ memberships: memberships.filter((k) => k !== key), rateOverrides: rest });
    } else {
      onUpdate({ memberships: [...memberships, key] });
    }
  };

  const setRate = (key: string, cents: number) =>
    onUpdate({ rateOverrides: { ...rateOverrides, [key]: cents } });

  const updateCustom = (i: number, patch: Partial<{ brand: string; cents: number }>) =>
    onUpdate({ customRules: customRules.map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const addCustom = () =>
    onUpdate({ customRules: [...customRules, { brand: "", cents: 4 }] });
  const removeCustom = (i: number) =>
    onUpdate({ customRules: customRules.filter((_, j) => j !== i) });

  return (
    <div className="mb-lg">
      <div className="mb-2 flex items-center gap-1.5 text-sm text-text-secondary">
        Membership / fuel discount
        <InfoTooltip label="How discounts work">
          We rank on your <span className="text-text">effective price</span> (pump − your
          discount). A 4–5c/L card can beat the pump-cheapest station. We apply the single
          best discount per station — no stacking — and never ask at the pump.
        </InfoTooltip>
      </div>

      <div className="flex flex-wrap gap-2">
        {catalog.map((p) => (
          <Chip
            key={p.key}
            active={memberships.includes(p.key)}
            onClick={() => toggle(p.key)}
            label={p.label}
          />
        ))}
      </div>

      {/* Editable rate per selected card — the user owns the number. */}
      {catalog
        .filter((p) => memberships.includes(p.key))
        .map((p) => (
          <div key={p.key} className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="truncate text-text-secondary">{p.label}</span>
            <RateInput
              value={rateOverrides[p.key] ?? defaultRate(p)}
              onChange={(c) => setRate(p.key, c)}
            />
          </div>
        ))}

      {/* Custom "−Xc at [brand]" for anything off-catalog. */}
      {customRules.map((r, i) => (
        <div key={i} className="mt-2 flex items-center gap-2 text-sm">
          <input
            value={r.brand}
            onChange={(e) => updateCustom(i, { brand: e.target.value })}
            placeholder="Brand (e.g. Costco)"
            className="min-w-0 flex-1 rounded-md border border-border bg-[color:var(--color-card-raised)] px-2 py-1.5 text-text placeholder:text-text-secondary focus:border-border-strong focus:outline-none"
          />
          <RateInput value={r.cents} onChange={(c) => updateCustom(i, { cents: c })} />
          <button
            onClick={() => removeCustom(i)}
            aria-label="Remove discount"
            className="text-text-secondary hover:text-text"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addCustom}
        className="mt-2 text-xs text-text-action hover:underline"
      >
        + Add a custom discount
      </button>
    </div>
  );
}

function RateInput({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1">
      <input
        type="number"
        min={0}
        max={50}
        step={1}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        className="w-10 bg-transparent text-right text-text focus:outline-none"
      />
      <span className="text-xs text-text-secondary">c/L</span>
    </span>
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
