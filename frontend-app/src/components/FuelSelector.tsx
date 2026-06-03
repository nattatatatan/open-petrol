/** Fuel type is first-class and persistent (CLAUDE.md §7) — a closed list, and
 *  every result is scoped to the selected fuel. */
export function FuelSelector({
  fuelTypes,
  value,
  onChange,
}: {
  fuelTypes: Record<string, string>;
  value: string;
  onChange: (code: string) => void;
}) {
  const entries = Object.entries(fuelTypes).filter(([code]) => code !== "EV");
  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-display text-text-secondary">
        Fuel type
      </div>
      {/* Discrete set → wrapped chips, not a scrolling row (which reads as a slider). */}
      <div className="flex flex-wrap gap-2">
        {entries.map(([code, label]) => {
          const active = code === value;
          return (
            <button
              key={code}
              onClick={() => onChange(code)}
              title={label}
              aria-pressed={active}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                active
                  ? "border-brand bg-brand text-[color:var(--color-text-onAction)]"
                  : "border-border text-text-secondary hover:border-border-strong hover:text-text"
              }`}
            >
              {code}
            </button>
          );
        })}
      </div>
    </div>
  );
}
