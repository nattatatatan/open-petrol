import type { UserModel } from "../types";
import { Button } from "./ui";

/** Bottom-sheet for the user model: tank size (makes saving-per-fill THEIRS),
 *  usual-station baseline, and theme. */
export function SettingsSheet({
  open,
  model,
  usualStationName,
  onUpdate,
  onClose,
}: {
  open: boolean;
  model: UserModel;
  usualStationName: string | null;
  onUpdate: (patch: Partial<UserModel>) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-xl border border-border bg-[color:var(--color-card)] p-lg pb-[calc(24px+env(safe-area-inset-bottom))]">
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
                Usual: <span className="font-medium text-text">{usualStationName ?? model.usualStation}</span>
              </span>
              <button
                className="text-xs text-text-action hover:underline"
                onClick={() => onUpdate({ usualStation: null })}
              >
                Clear
              </button>
            </div>
          ) : (
            <p className="text-xs text-text-secondary">
              Compared against the <span className="text-text">area average</span>. Tap “Set as my
              usual” on any station to anchor savings to it.
            </p>
          )}
        </div>

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
