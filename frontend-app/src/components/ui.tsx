import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Figma "Large button" Hierarchy axis. `ghost` is retained as the inline/tertiary
   *  text-button role (Figma "Tertiary button"). */
  hierarchy?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "default" | "small";
  /** Figma "Surface" axis — which surface the button sits on. Defaults to `dark`
   *  (the app's page surface). Only changes the outlined/text hierarchies. */
  surface?: "dark" | "light";
  loading?: boolean;
};

export function Button({
  hierarchy = "primary",
  size = "default",
  surface = "dark",
  loading = false,
  className = "",
  children,
  disabled,
  ...rest
}: ButtonProps) {
  // 16px radius (rounded-lg) per the design scale — buttons are not pills.
  const base =
    "inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-page)] focus-visible:ring-white/40";
  // Heights per the finalized spec (Large button: default 60, small 40).
  const sizes = {
    default: "h-[60px] px-5 text-base",
    small: "h-[44px] px-4 text-sm",
  };
  // On a light surface the outlined/text variants need dark ink + dark border.
  const onLight = surface === "light";
  // Primary = a DARK RAISED surface with a WHITE label (reference "View offer →"),
  // NOT a gold fill. Gold is reserved for the winner pill, never button chrome.
  const hierarchies = {
    primary:
      "bg-[color:var(--color-card-raised)] text-text border border-white/10 hover:border-white/25",
    secondary: onLight
      ? "bg-transparent text-black border border-black/30 hover:border-black"
      : "bg-transparent text-text border border-border hover:border-border-strong",
    destructive: "bg-destructive text-white hover:brightness-110",
    ghost: onLight
      ? "bg-transparent text-black hover:text-text"
      : "bg-transparent text-text-secondary hover:text-text",
  };
  return (
    <button
      className={`${base} ${sizes[size]} ${hierarchies[hierarchy]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  /** Maps the Figma Input "Error" state. Selected/Filled are handled by :focus
   *  and the value itself, so they don't need explicit props. */
  invalid?: boolean;
  /** Optional trailing affix (the spec's "Suffix type: Icon | Text"). */
  suffix?: ReactNode;
  size?: "default" | "small";
  /** Sit on the raised card surface (e.g. inside a sheet) instead of transparent.
   *  A prop, not a className, so it can't lose Tailwind's same-property sort order. */
  raised?: boolean;
};

// Padding/background are props (not className) because Tailwind resolves conflicting
// utilities by stylesheet order, so a className override of the base px/py/bg would
// silently lose without tailwind-merge.
const INPUT_SIZES = { default: "px-3 py-3", small: "px-3 py-2" } as const;

/** Text input matching the spec's Input states (Default / Selected / Filled / Error).
 *  Selected (focus) uses the `highlighted` border role — the design system's distinct
 *  active-emphasis border — rather than `strong`. */
export function Input({
  invalid = false,
  suffix,
  size = "default",
  raised = false,
  className = "",
  ...rest
}: InputProps) {
  const bg = raised ? "bg-[color:var(--color-card-raised)]" : "bg-transparent";
  const field = "w-full bg-transparent text-text placeholder:text-text-secondary focus:outline-none";
  if (suffix) {
    // Border lives on the wrapper; focus-within mirrors the input's focus state.
    const wrap = invalid
      ? "border-border-error focus-within:border-border-error"
      : "border-border focus-within:border-border-highlighted";
    return (
      <div
        className={`flex items-center gap-2 rounded-lg border transition-colors ${INPUT_SIZES[size]} ${bg} ${wrap} ${className}`}
      >
        <input className={field} aria-invalid={invalid || undefined} {...rest} />
        <span className="shrink-0 text-text-secondary">{suffix}</span>
      </div>
    );
  }
  const border = invalid
    ? "border-border-error focus:border-border-error"
    : "border-border focus:border-border-highlighted";
  return (
    <input
      className={`rounded-lg border transition-colors ${INPUT_SIZES[size]} ${bg} ${border} text-text placeholder:text-text-secondary focus:outline-none ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block h-4 w-4 rounded-full border-2 border-current border-r-transparent animate-spin ${className}`}
      aria-hidden
    />
  );
}

export function Card({
  children,
  className = "",
  raised = false,
}: {
  children: ReactNode;
  className?: string;
  raised?: boolean;
}) {
  const bg = raised ? "bg-[color:var(--color-card-raised)]" : "bg-[color:var(--color-card)]";
  return (
    <div className={`${bg} border border-border rounded-lg ${className}`}>{children}</div>
  );
}

/** Tap-to-toggle info bubble (mobile has no hover) — for explanatory copy that
 *  doesn't need to sit on screen permanently. */
export function InfoTooltip({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px] text-text-secondary"
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-6 z-10 w-56 rounded-md border border-border bg-[color:var(--color-card-raised)] px-3 py-2 text-xs font-normal text-text-secondary shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}

/** Loading placeholder — soft pulse, never a blank screen (STYLE_GUIDE §10).
 *  The pulse is disabled under `prefers-reduced-motion` (see index.css). */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse-soft rounded-md bg-[color:var(--color-card-raised)] ${className}`}
    />
  );
}

export function Pill({
  children,
  color,
  className = "",
}: {
  children: ReactNode;
  color?: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${className}`}
      style={
        color
          ? { color, backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)` }
          : undefined
      }
    >
      {children}
    </span>
  );
}
