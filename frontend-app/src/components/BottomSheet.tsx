import { useEffect } from "react";
import type { ReactNode } from "react";

/** Shared bottom-sheet shell (STYLE_GUIDE §8: backdrop-blur, drag handle, dismiss
 *  on tap-away). Depth comes from a blurred backdrop + surface step, never a drop
 *  shadow (the design system defines no shadows). Backs Settings and the expanded
 *  map. Esc closes; body scroll is locked while open. */
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
    <div className="fixed inset-0 z-[1000] flex items-end justify-center" role="dialog" aria-modal aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-xl border border-border bg-[color:var(--color-card)] p-lg pb-[calc(24px+env(safe-area-inset-bottom))] ${contentClassName}`}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="mx-auto mb-lg block h-1 w-10 rounded-full bg-border"
        />
        {title && <h2 className="mb-lg text-lg font-bold text-text-heading">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
