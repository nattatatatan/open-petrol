/** Fuel type — first-class, persistent, a closed list (CLAUDE.md §7). The first-run
 *  variant (STYLE_GUIDE §7.2) is the ONLY upfront question, justified because showing
 *  the wrong fuel's saving is unsafe. The compact variant is the inline "change"
 *  refine on the answer. EV is excluded (not c/L-comparable). */
export function FuelChooser({
  fuelTypes,
  value,
  onChange,
  variant = "compact",
}: {
  fuelTypes: Record<string, string>;
  value: string;
  onChange: (code: string) => void;
  variant?: "firstrun" | "compact";
}) {
  const entries = Object.entries(fuelTypes).filter(([code]) => code !== "EV");

  if (variant === "firstrun") {
    return (
      <div className="grid grid-cols-3 gap-sm">
        {entries.map(([code, label]) => {
          const active = code === value;
          return (
            <button
              key={code}
              onClick={() => onChange(code)}
              title={label}
              aria-pressed={active}
              className={`flex h-[56px] flex-col items-center justify-center rounded-md border text-base font-medium transition-colors ${
                active
                  ? "border-brand bg-brand text-[color:var(--color-text-onAction)]"
                  : "border-border text-text hover:border-border-strong"
              }`}
            >
              {code}
            </button>
          );
        })}
      </div>
    );
  }

  // Discrete set → wrapped chips, not a scrolling row (which reads as a slider).
  return (
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
  );
}
