import { HScroll } from "./ui";

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
              className={`flex h-[56px] flex-col items-center justify-center rounded-lg border text-base font-medium transition-colors ${
                active
                  ? "border-transparent bg-[color:var(--color-surface-secondary)] text-[color:var(--color-surface-page)]"
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

  // Inline refine: a single scrollable row (slider) — tidy, full-width-aligned,
  // with an edge fade so it's obvious more fuels sit off-screen. A label tells the
  // user the bare fuel codes (E10, U91…) ARE the fuel-type selector — scanability.
  return (
    <div>
      <p className="cap mb-1.5 px-1 text-text-secondary">Fuel type</p>
      <HScroll fade="none">
        {entries.map(([code, label]) => {
          const active = code === value;
          return (
            <button
              key={code}
              onClick={() => onChange(code)}
              title={label}
              aria-pressed={active}
              className={`inline-flex min-h-[44px] shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                active
                  ? "border-transparent bg-[color:var(--color-surface-secondary)] text-[color:var(--color-surface-page)]"
                  : "border-border text-text-secondary hover:border-border-strong hover:text-text"
              }`}
            >
              {code}
            </button>
          );
        })}
      </HScroll>
    </div>
  );
}
