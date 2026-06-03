/** Tailwind config bound to the design-system tokens (see /frontend).
 *  Components reference these semantic keys; the CSS variables (tokens.css) carry
 *  the actual light/dark values, so theme switching is automatic. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        text: {
          DEFAULT: "var(--color-text-body)",
          heading: "var(--color-text-headings)",
          secondary: "var(--color-text-bodySecondary)",
          action: "var(--color-text-action)",
          onAction: "var(--color-text-onAction)",
          error: "var(--color-text-error)",
          alert: "var(--color-text-alert)",
        },
        surface: {
          page: "var(--color-surface-page)",
          primary: "var(--color-surface-primary)",
          secondary: "var(--color-surface-secondary)",
          tertiary: "var(--color-surface-tertiary)",
          brand: "var(--color-surface-brand)",
          accent: "var(--color-surface-accent)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
          highlighted: "var(--color-border-highlighted)",
          error: "var(--color-border-error)",
        },
        brand: "var(--color-brand)",
        accent: "var(--color-accent)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
      },
      fontFamily: {
        heading: ["NeueHaasGrotDispRD", "Inter", "system-ui", "sans-serif"],
        body: ["NeueHaasGrotDispRD", "Inter", "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "ui-monospace", "monospace"],
      },
      spacing: {
        xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px",
        "2xl": "40px", "3xl": "48px", "4xl": "56px",
      },
      borderRadius: { DEFAULT: "4px", md: "8px", lg: "16px", xl: "24px", full: "9999px" },
      borderWidth: { DEFAULT: "1px", md: "2px" },
    },
  },
  plugins: [],
};
