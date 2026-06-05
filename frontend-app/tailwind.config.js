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
          actionHover: "var(--color-text-actionHover)",
          onAction: "var(--color-text-onAction)",
          error: "var(--color-text-error)",
          warning: "var(--color-text-warning)",
          alert: "var(--color-text-alert)",
          disabled: "var(--color-text-disabled)",
        },
        icon: {
          DEFAULT: "var(--color-icon-primary)",
          primary: "var(--color-icon-primary)",
          disabled: "var(--color-icon-disabled)",
          action: "var(--color-icon-action)",
          actionHover: "var(--color-icon-actionHover)",
          error: "var(--color-icon-error)",
          warning: "var(--color-icon-warning)",
          alert: "var(--color-icon-alert)",
          success: "var(--color-icon-success)",
          onAction: "var(--color-icon-onAction)",
        },
        surface: {
          page: "var(--color-surface-page)",
          primary: "var(--color-surface-primary)",
          secondary: "var(--color-surface-secondary)",
          tertiary: "var(--color-surface-tertiary)",
          error: "var(--color-surface-error)",
          disabled: "var(--color-surface-disabled)",
          brand: "var(--color-surface-brand)",
          accent: "var(--color-surface-accent)",
          accentSecondary: "var(--color-surface-accentSecondary)",
        },
        border: {
          DEFAULT: "var(--color-border-default)",
          strong: "var(--color-border-strong)",
          highlighted: "var(--color-border-highlighted)",
          error: "var(--color-border-error)",
          alert: "var(--color-border-alert)",
        },
        divider: {
          DEFAULT: "var(--color-divider-default)",
          subtle: "var(--color-divider-subtle)",
        },
        brand: "var(--color-brand)",
        accent: "var(--color-accent)",
        destructive: "var(--color-destructive)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        /* Product-semantic intent aliases (STYLE_GUIDE §6). */
        winner: "var(--decision-winner)",
        saving: "var(--saving-positive)",
        confidence: {
          fresh: "var(--confidence-fresh)",
          ageing: "var(--confidence-ageing)",
          stale: "var(--confidence-stale)",
        },
        detour: "var(--detour-cost)",
      },
      fontFamily: {
        heading: ["NeueHaasGrotDispRD", "Inter", "system-ui", "sans-serif"],
        body: ["NeueHaasGrotDispRD", "Inter", "system-ui", "sans-serif"],
        mono: ['"DM Mono"', "ui-monospace", "monospace"],
      },
      /* Finalized type ramp from design-tokens.json (lineHeight + letterSpacing in px).
       * Base 35Thin weight is intentional; "strong" steps to Roman/Medium — apply via
       * font-* utilities. Responsive shifts (h1 42→46, h2 32→36, caption 11→15) are
       * left to md: overrides where these sizes are used. */
      fontSize: {
        "display-1": ["96px", { lineHeight: "96px", letterSpacing: "3.84px" }],
        "display-2": ["64px", { lineHeight: "64px", letterSpacing: "2.56px" }],
        h1: ["42px", { lineHeight: "42px", letterSpacing: "1.68px" }],
        h2: ["32px", { lineHeight: "40px", letterSpacing: "1.12px" }],
        h3: ["28px", { lineHeight: "32px", letterSpacing: "1.12px" }],
        "body-xl": ["24px", { lineHeight: "28px", letterSpacing: "0.96px" }],
        "body-lg": ["20px", { lineHeight: "28px", letterSpacing: "0.4px" }],
        "body-default": ["16px", { lineHeight: "24px", letterSpacing: "0.64px" }],
        "body-sm": ["14px", { lineHeight: "16px", letterSpacing: "0.56px" }],
        "body-xs": ["12px", { lineHeight: "16px", letterSpacing: "0.24px" }],
        "body-xxs": ["10px", { lineHeight: "10px", letterSpacing: "0.4px" }],
        caption: ["11px", { lineHeight: "16px", letterSpacing: "0.11px" }],
      },
      spacing: {
        xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px",
        "2xl": "40px", "3xl": "48px", "4xl": "56px",
      },
      borderRadius: { none: "0px", DEFAULT: "4px", md: "8px", lg: "4px", xl: "4px", full: "9999px" },
      borderWidth: { DEFAULT: "1px", md: "2px" },
      /* Effect-style blur scale (md=12, no 4xl) — no drop shadows exist in the system. */
      blur: {
        sm: "4px", DEFAULT: "8px", md: "12px", lg: "16px", xl: "24px", "2xl": "40px", "3xl": "64px",
      },
      backdropBlur: {
        sm: "4px", DEFAULT: "8px", md: "12px", lg: "16px", xl: "24px", "2xl": "40px", "3xl": "64px",
      },
    },
  },
  plugins: [],
};
