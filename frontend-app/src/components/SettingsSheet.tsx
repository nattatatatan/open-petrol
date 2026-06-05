import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { Coords } from "../hooks/useGeolocation";
import type { CatalogPreset, StationHit, UserModel } from "../types";
import { formatDistance } from "../lib/format";
import { Button, HScroll, InfoTooltip, Input, SearchIcon } from "./ui";
import { BottomSheet } from "./BottomSheet";

const PREMIUM_FUELS = ["P95", "P98"];

/** Bottom-sheet for the user model: tank size (makes saving-per-fill THEIRS), the
 *  usual-station baseline (set via typeahead — CLAUDE.md §7 thread D), and membership
 *  effective pricing (thread A). */
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
  return (
    <BottomSheet open={open} onClose={onClose} title="Your settings">
      <div>
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
          className="mb-lg w-full accent-[color:var(--color-text-body)]"
        />

        <div className="mb-lg">
          <div className="mb-1 text-sm text-text-secondary">Savings baseline</div>
          {model.usualStation ? (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <span className="text-sm">
                Usual: <span className="font-medium text-text">{model.usualStationName ?? usualStationName ?? model.usualStation}</span>
              </span>
              <button
                className="text-xs text-text hover:underline"
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

        <Button className="mt-xl w-full" onClick={onClose}>
          Done
        </Button>
      </div>
    </BottomSheet>
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

      <HScroll fade="card">
        {catalog.map((p) => (
          <Chip
            key={p.key}
            active={memberships.includes(p.key)}
            onClick={() => toggle(p.key)}
            label={p.label}
          />
        ))}
      </HScroll>

      {/* Editable rate per selected card — same row shape as a custom rule (label,
          rate, ×) so predefined and custom read consistently. The × deselects. */}
      {catalog
        .filter((p) => memberships.includes(p.key))
        .map((p) => (
          <div key={p.key} className="mt-2 flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-text-secondary">{p.label}</span>
            <RateInput
              value={rateOverrides[p.key] ?? defaultRate(p)}
              onChange={(c) => setRate(p.key, c)}
            />
            <button
              onClick={() => toggle(p.key)}
              aria-label={`Remove ${p.label}`}
              className="px-1 text-text-secondary hover:text-text"
            >
              ×
            </button>
          </div>
        ))}

      {/* Custom "−Xc at [brand]" for anything off-catalog. */}
      {customRules.map((r, i) => (
        <div key={i} className="mt-2 flex items-center gap-2 text-sm">
          <Input
            value={r.brand}
            onChange={(e) => updateCustom(i, { brand: e.target.value })}
            placeholder="Brand (e.g. Costco)"
            size="small"
            raised
            className="min-w-0 flex-1 text-sm"
          />
          <RateInput value={r.cents} onChange={(c) => updateCustom(i, { cents: c })} />
          <button
            onClick={() => removeCustom(i)}
            aria-label="Remove discount"
            className="px-1 text-text-secondary hover:text-text"
          >
            ×
          </button>
        </div>
      ))}
      <button
        onClick={addCustom}
        className="mt-3 text-xs text-text hover:underline"
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
      className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm transition-colors ${
        active
          ? "border-transparent bg-[color:var(--color-surface-secondary)] font-medium text-[color:var(--color-surface-page)]"
          : "border-border text-text-secondary hover:border-border-strong hover:text-text"
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
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onClear={q ? () => setQ("") : undefined}
        placeholder="Search your usual station…"
        prefix={<SearchIcon />}
        size="small"
        raised
        className="text-sm"
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
