export type Mode = "route" | "near";

/** The single mode affordance (STYLE_GUIDE §3) — an in-context toggle, NOT
 *  navigation/tabs. "Near me now" is the cold-open default (answers in ~0 taps);
 *  "On my way" is the prominent opt-in route flow. */
export function ModeToggle({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Search mode"
      className="grid grid-cols-2 gap-1 rounded-full border border-border p-1"
    >
      {([
        ["near", "Near me now"],
        ["route", "On my way"],
      ] as [Mode, string][]).map(([m, label]) => {
        const active = mode === m;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className={`flex min-h-[44px] items-center justify-center rounded-full text-sm font-semibold transition-colors ${
              active
                ? "bg-[color:var(--color-card-raised)] text-text"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
