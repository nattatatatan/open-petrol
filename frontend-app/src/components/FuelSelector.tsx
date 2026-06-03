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
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {entries.map(([code, label]) => {
        const active = code === value;
        return (
          <button
            key={code}
            onClick={() => onChange(code)}
            title={label}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
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
