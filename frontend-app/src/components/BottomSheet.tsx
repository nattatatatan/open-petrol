import { useEffect } from "react";
import type { ReactNode } from "react";

/** Shared centered modal shell (backdrop-blur, dismiss on tap-away). Centered —
 *  not bottom-anchored — so it sits clear of mobile browser chrome / the home
 *  indicator and never clips its own footer (e.g. the Settings "Done" button).
 *  A fixed header (title + ✕) tops a scrollable body, so content is always fully
 *  reachable. Depth is a blurred backdrop + surface step, never a drop shadow.
 *  Backs Settings and the expanded map. Esc closes; body scroll locks while open. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  contentClassName = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  contentClassName?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
      role="dialog"
      aria-modal
      aria-label={title}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-xl border border-border bg-[color:var(--color-card)] ${contentClassName}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 px-lg pt-lg pb-md">
          {title && <h2 className="text-[22px] font-extralight tracking-display text-text-heading">{title}</h2>}
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1 ml-auto flex h-9 w-9 items-center justify-center rounded-full text-lg text-text-secondary hover:text-text"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-lg pb-[calc(24px+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
