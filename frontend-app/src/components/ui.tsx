import { useState } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Figma "Large button" Hierarchy axis. `ghost` is retained as the inline/tertiary
   *  text-button role (Figma "Tertiary button"). */
  hierarchy?: "primary" | "secondary" | "destructive" | "ghost";
  size?: "default" | "small";
  loading?: boolean;
};

export function Button({
  hierarchy = "primary",
  size = "default",
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
  // Emphasis by INVERSION (VISUAL-LANGUAGE §2/§7): on our dark screens the primary
  // CTA is the single white solid moment — white fill, black label, trailing arrow.
  // This is the one inverted element per screen; gold stays reserved for the winner
  // pill, never button chrome.
  const hierarchies = {
    primary:
      "bg-[color:var(--color-surface-secondary)] text-[color:var(--color-surface-page)] hover:brightness-90",
    secondary: "bg-transparent text-text border border-border hover:border-border-strong",
    destructive: "bg-destructive text-white hover:brightness-110",
    ghost: "bg-transparent text-text-secondary hover:text-text",
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

// "prefix" omitted because HTMLAttributes already defines prefix?: string, which
// conflicts with our ReactNode prefix prop.
type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> & {
  invalid?: boolean;
  prefix?: ReactNode;
  suffix?: ReactNode;
  onClear?: () => void;
  size?: "default" | "small";
  raised?: boolean;
};

// Padding/background are props (not className) because Tailwind resolves conflicting
// utilities by stylesheet order, so a className override of the base px/py/bg would
// silently lose without tailwind-merge.
const INPUT_SIZES = { default: "px-4 py-3.5", small: "px-3 py-2.5" } as const;

/** Text input matching the spec's Input states (Default / Selected / Filled / Error).
 *  Selected (focus) uses the `highlighted` border role — the design system's distinct
 *  active-emphasis border — rather than `strong`. */
export function Input({
  invalid = false,
  prefix,
  suffix,
  onClear,
  size = "default",
  raised = false,
  className = "",
  value,
  ...rest
}: InputProps) {
  const bg = raised ? "bg-[color:var(--color-card-raised)]" : "bg-[color:var(--color-card)]";
  const shape = `rounded-lg ${INPUT_SIZES[size]}`;
  const field = "min-w-0 flex-1 bg-transparent text-text placeholder:text-text-secondary focus:outline-none";
  const showClear = !!onClear && !!value && String(value).length > 0;
  const hasWrapper = !!(prefix || suffix || onClear);

  if (hasWrapper) {
    const wrap = invalid
      ? "border-border-error focus-within:border-border-error"
      : "border-border focus-within:border-border-highlighted";
    return (
      <div className={`flex w-full items-center gap-2 border transition-colors ${shape} ${bg} ${wrap} ${className}`}>
        {prefix && <span className="shrink-0 text-text-secondary">{prefix}</span>}
        <input className={field} value={value} aria-invalid={invalid || undefined} {...rest} />
        {showClear && (
          <button type="button" onClick={onClear} aria-label="Clear" className="shrink-0 text-text-secondary hover:text-text">
            <ClearIcon />
          </button>
        )}
        {suffix && <span className="shrink-0 text-text-secondary">{suffix}</span>}
      </div>
    );
  }
  const border = invalid
    ? "border-border-error focus:border-border-error"
    : "border-border focus:border-border-highlighted";
  return (
    <input
      className={`w-full border transition-colors ${shape} ${bg} ${border} text-text placeholder:text-text-secondary focus:outline-none ${className}`}
      value={value}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

export function SearchIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 16 16" fill="white" aria-hidden>
      <path d="M7 2a5 5 0 1 0 3.23 8.76l2.5 2.5a.75.75 0 1 0 1.06-1.06l-2.5-2.5A5 5 0 0 0 7 2zm-3.5 5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0z"/>
    </svg>
  );
}

export function FuelPumpIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden>
      <path d="M19.77 7.23l.01-.01-3.72-3.72-1.06 1.06 2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM18 10.5c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zM8 18v-4.5h5V18H8zm0-6V5h5v7H8z"/>
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 14 14" fill="white" aria-hidden>
      <path d="M11.3 2.7a1 1 0 0 0-1.4 0L7 5.6 4.1 2.7A1 1 0 0 0 2.7 4.1L5.6 7 2.7 9.9a1 1 0 0 0 1.4 1.4L7 8.4l2.9 2.9a1 1 0 0 0 1.4-1.4L8.4 7l2.9-2.9a1 1 0 0 0 0-1.4z"/>
    </svg>
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
          className="absolute left-0 top-6 z-10 w-56 rounded-md border border-border bg-[color:color-mix(in_srgb,var(--color-card-raised)_92%,transparent)] px-3 py-2 text-xs font-normal text-text-secondary backdrop-blur-md"
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

/** Horizontal "slider" row for chip groups (fuel, memberships). Single line,
 *  scrollable, with a right-edge fade so it's OBVIOUS more sits off-screen — the
 *  last chip deliberately peeks under the fade. `fade` matches the surface it sits
 *  on (page vs card) so the gradient blends. Children should be `shrink-0`. */
export function HScroll({
  children,
  fade = "page",
  className = "",
}: {
  children: ReactNode;
  fade?: "page" | "card" | "none";
  className?: string;
}) {
  const from = fade === "card" ? "var(--color-card)" : "var(--color-surface-page)";
  return (
    <div className={`relative ${className}`}>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
      {fade !== "none" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8"
          style={{ background: `linear-gradient(to left, ${from}, transparent)` }}
        />
      )}
    </div>
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
