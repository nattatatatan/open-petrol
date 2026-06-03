# Implementation Notes

## Extraction status (read this first)

This spec is **partial**. Extraction stopped when the Figma MCP connection returned a hard
**Starter-plan tool-call limit**. What is confirmed vs. missing:

| Area | Status |
|---|---|
| Color primitives, semantic alias, light/dark mapped tokens | ✅ confirmed |
| Spacing, radius, border-width, blur | ✅ confirmed |
| Font family + font weight primitives | ✅ confirmed |
| Type scale (display1, h1, h2, h3, body.xl) | ⚠️ partial (rest truncated) |
| Named text styles, effect/shadow styles, grid styles | ❌ not retrieved |
| Breakpoint pixel thresholds | ❌ not encoded as variables |
| Button component variant matrix | ✅ confirmed (from metadata) |
| Per-component token bindings | ❌ not retrieved |
| All other component pages (17) | ❌ not retrieved |
| Logos / Icons / Imagery asset lists | ❌ not retrieved |

To finish, re-run extraction after the limit resets (or upgrade the Figma plan), using the
node IDs recorded in `components-spec.json` and `asset-manifest.json`.

## Theming strategy: CSS variables (recommended)

The system has three token layers — implement them in that order:

1. **Primitives** (`grey/*`, `gold/*`, …) → static CSS vars, never referenced directly by components.
2. **Semantic alias** (`Neutral/*`, `Brand/*`, `Accent/*`, `Destructive/*`, `Success/*`) → reference primitives.
3. **Mapped** (`text/*`, `surface/*`, `icon/*`, `border/*`, `divider/*`) → **theme-switched** (Light/Dark). Components bind ONLY to these.

```css
:root, [data-theme="light"] {
  --color-text-body: #000000;
  --color-surface-secondary: #FFFFFF;
  --color-border-default: #C3C9CF;
  /* …mapped layer, light values… */
}
[data-theme="dark"] {
  --color-text-body: #FFFFFF;
  --color-border-default: #3B3C3F;
  /* …mapped layer, dark values… */
}
```

Note: several `surface/*` tokens (`page`, `primary`, `brand`, `accent`) are identical across
Light and Dark — the system is only partially dual-themed. `text/*`, `icon/*`, `border/*`,
`divider/*` carry the real light/dark differences.

## Tailwind strategy

Map mapped-layer tokens to semantic Tailwind color keys backed by the CSS vars, so dark mode is automatic:

```js
// tailwind.config.js (excerpt)
theme: {
  extend: {
    colors: {
      text: { DEFAULT: 'var(--color-text-body)', secondary: 'var(--color-text-bodySecondary)', action: 'var(--color-text-action)', error: 'var(--color-text-error)' },
      surface: { primary: 'var(--color-surface-primary)', secondary: 'var(--color-surface-secondary)', brand: 'var(--color-surface-brand)', accent: 'var(--color-surface-accent)' },
      border: { DEFAULT: 'var(--color-border-default)', strong: 'var(--color-border-strong)', error: 'var(--color-border-error)' },
    },
    spacing: { xs:'4px', sm:'8px', md:'16px', lg:'24px', xl:'32px', '2xl':'40px', '3xl':'48px', '4xl':'56px' },
    borderRadius: { DEFAULT:'4px', md:'8px', lg:'16px', xl:'24px', full:'9999px' },
    borderWidth: { DEFAULT:'1px', md:'2px' },
    fontFamily: { heading:['NeueHaasGrotDispRD','sans-serif'], body:['NeueHaasGrotDispRD','sans-serif'], caption:['"DM Mono"','monospace'] },
  }
}
```

The spacing/radius/border scales come straight from the confirmed `Allias` collection — safe to hardcode.

## Typography caveats

- Both heading and body families resolve to **`NeueHaasGrotDispRD`**; only caption differs (**`DM Mono`**). Ensure both fonts are licensed/loaded.
- Figma stores font **style strings** (`Roman`, `Medium`, `Bold`, `Light`, `35Thin`). The numeric CSS weights in `design-tokens.json` are suggestions — verify against the actual font's named instances.
- Letter-spacing is in **px** and tracks at ~**4% of font size** across captured headings. In CSS, `letter-spacing: 0.04em` reproduces this without per-style values.
- h1 and display are the only styles that scale between Mobile/Desktop (42→46 / others fixed). Use responsive utilities only where mobile≠desktop.
- `body.lg/md/sm` and `caption` sizes are **undefined** here — do not invent them.

## React component mapping (Button — the one confirmed component)

```tsx
type ButtonProps = {
  hierarchy?: 'primary' | 'secondary' | 'destructive'; // 'Hierarchy' axis
  size?: 'default' | 'small';                            // 'Size' axis
  state?: 'enabled' | 'disabled' | 'loading';            // 'State' axis (loading is a real variant)
  surface?: 'light' | 'dark';                            // 'Surface' axis
};
```

Other button families map to their own components: `AuthButton` (provider × mode),
`InlineButton` (state), `RoundButton`, `EmphasizeButton`, `IconButton`/`SmallButtonIcon` (size),
`ArrowButton` (theme × size). Confirmed heights: large 60, small 40, auth 54, arrow large 64 /
medium 56 / xl 192, large-icon 78, round 36, emphasize 48×48, inline 24.

Hover is **not** a Figma variant — implement hover in code using the `*-hover` mapped tokens
(`text/action-hover`, `icon/action-hover`).

## Suggested folder structure

```
src/
  styles/
    tokens.primitives.css     # grey/gold/blue/... (static)
    tokens.semantic.css       # neutral/brand/accent/... -> primitives
    tokens.mapped.light.css   # text/surface/icon/border/divider (light)
    tokens.mapped.dark.css    # ...(dark)
  tokens/
    design-tokens.json        # this extraction (source of truth for codegen)
  components/
    Button/ (Button, AuthButton, InlineButton, RoundButton, IconButton, ArrowButton)
    Badge/ Tag/ Input/ Control/ Tile/ ListItem/ Uploader/ Navigation/
    Selector/ Card/ SystemStatus/ Avatar/ Overlay/ EmptyMessage/ Chart/ Divider/
  icons/                      # SVGs, inherit currentColor from color.icon.* tokens
  assets/logos/
```

## Missing / ambiguous tokens (explicit)

- **Breakpoint px values** — undefined; only mode names (`Mobile`, `Desktop`) exist.
- **Grid/columns/margins/gutters** — undefined (grid styles not retrieved).
- **Shadow/elevation** — undefined (effect styles not retrieved); only `Blur/*` numeric tokens captured.
- **Icon sizing & stroke width** — undefined; no icon-size variable in foundation.
- **Type scale below body.xl** — undefined.
- **Figma spelling note:** the destructive role is spelled **`Desctructive`** in the file — code should normalize to `destructive`.
