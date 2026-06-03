import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  hierarchy?: "primary" | "secondary" | "ghost";
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
  const base =
    "inline-flex items-center justify-center gap-2 font-semibold rounded-full transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-surface-page)] focus-visible:ring-brand";
  const sizes = {
    default: "h-[52px] px-6 text-[15px]",
    small: "h-[40px] px-4 text-sm",
  };
  const hierarchies = {
    primary: "bg-brand text-[color:var(--color-text-onAction)] hover:brightness-105",
    secondary:
      "bg-transparent text-text border border-border hover:border-border-strong",
    ghost: "bg-transparent text-text-action hover:text-text",
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
