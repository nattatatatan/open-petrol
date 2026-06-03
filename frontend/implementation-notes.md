# Implementation Notes

## Status: complete

All four artifacts are now fully populated from the Figma file. Foundation tokens and all 18
component variant matrices are confirmed. The only items still marked `undefined` are things
that genuinely don't exist as encoded values in the file (see "Gaps" below) — not extraction
failures.

| Area | Status |
|---|---|
| Color (primitive / semantic / mapped light+dark) | confirmed |
| Spacing, radius, border-width, blur | confirmed |
| Typography — full ramp, families, weights, responsive sizes | confirmed |
| Effect styles (blur only; no shadows) | confirmed |
| Grid (6-col mobile / 12-col desktop) + container max-widths | confirmed |
| All 18 component pages, variant axes | confirmed |
| Logo set + icon system structure | confirmed |

## Theming: three-layer CSS variables

1. Primitives (`grey/*`, `gold/*`, …) → static.
2. Semantic alias (`brand`, `accent`, `destructive`, `success`, `visualization`) → reference primitives.
3. Mapped (`text/*`, `surface/*`, `icon/*`, `border/*`, `divider/*`) → theme-switched. Components bind ONLY here.

```css
:root, [data-theme="light"] { --color-text-body:#000; --color-surface-secondary:#FFF; --color-border-default:#C3C9CF; }
[data-theme="dark"]        { --color-text-body:#FFF; --color-border-default:#3B3C3F; }
```

Several `surface/*` tokens are identical across modes; the real light/dark deltas live in
`text/*`, `icon/*`, `border/*`, `divider/*`.

## Typography (important quirks)

- Both heading and body families are `NeueHaasGrotDispRD`; only caption differs (`DM Mono`).
- Base headings and large body use weight `35Thin` (ultra-thin) — this is intentional. "Strong"
  variants step up: `body.lg-strong` = Roman, `body.default-strong` = Medium. Small sizes
  (`sm/xs/xxs`) use Roman because Thin is illegible at <=14px.
- Letter-spacing is in px (~4% of font size on headings; `0.04em` reproduces it).
- Responsive shifts between Mobile/Desktop exist only for: h1 (42→46), h2 (32→36), caption (11→15).
  Everything else is fixed across breakpoints.

## Tailwind config (excerpt)

```js
theme: { extend: {
  colors: {
    text:{DEFAULT:'var(--color-text-body)',secondary:'var(--color-text-bodySecondary)',action:'var(--color-text-action)',error:'var(--color-text-error)'},
    surface:{primary:'var(--color-surface-primary)',secondary:'var(--color-surface-secondary)',brand:'var(--color-surface-brand)',accent:'var(--color-surface-accent)'},
    border:{DEFAULT:'var(--color-border-default)',strong:'var(--color-border-strong)',error:'var(--color-border-error)'},
  },
  spacing:{xs:'4px',sm:'8px',md:'16px',lg:'24px',xl:'32px','2xl':'40px','3xl':'48px','4xl':'56px'},
  borderRadius:{DEFAULT:'4px',md:'8px',lg:'16px',xl:'24px',full:'9999px'},
  borderWidth:{DEFAULT:'1px',md:'2px'},
  fontFamily:{heading:['NeueHaasGrotDispRD','sans-serif'],body:['NeueHaasGrotDispRD','sans-serif'],caption:['"DM Mono"','monospace']},
  screens:{ md:'768px' }, // inferred — see Gaps
  maxWidth:{xs:'320px',sm:'384px',md:'448px',lg:'512px',xl:'576px','2xl':'672px','3xl':'768px'},
}}
```

Grid: mobile 6 columns / 8px gutter / 16px margin; desktop 12 columns / 16px gutter / 16px margin.

## React component mapping

Map each Figma variant axis to an enum prop. Examples:

```tsx
type ButtonProps   = { hierarchy?:'primary'|'secondary'|'destructive'; size?:'default'|'small'; state?:'enabled'|'disabled'|'loading'; surface?:'light'|'dark' };
type BadgeProps    = { hierarchy?:'accent'|'secondary'|'primaryWhite'|'primaryDark'; size?:'small'|'medium' };
type InputProps    = { state?:'default'|'selected'|'filled'|'error'|'selectedFilled'; suffix?:'icon'|'text' };
type CheckboxProps = { state?:'unselected'|'selected'|'indeterminate'; stroke?:boolean; theme?:'light'|'dark' };
type SwitchProps   = { on?:boolean };
type AvatarProps   = { size?:'small'|'large'; variant?:'image'|'text' };
type DividerProps  = { scale?:'default'|'subtle'; surface?:'light'|'dark' };
```

Hover is never a Figma variant — implement in code via the `*-action-hover` tokens.

## Icons

- One component per icon, sizes xs=16 / s=20 / m=24 / l=32. Export as SVG, single-color, wired to
  `currentColor` so they inherit `color.icon.*`. Build an `<Icon name size>` wrapper around the set.
- Names are kebab-case. ~19+ icon families confirmed by name; the page also mixes in partner/bank
  and card-network logos — keep those out of the generic icon component.
- The uploaded `Attribution--Streamline-Sharp-Remix.svg` is a third-party Streamline icon, not part
  of this set — verify its license before shipping.

## Suggested folder structure

```
src/
  styles/ tokens.primitives.css  tokens.semantic.css  tokens.mapped.light.css  tokens.mapped.dark.css
  tokens/ design-tokens.json
  components/ Button/ Badge/ Tag/ Input/ Control/ Tile/ ListItem/ Uploader/ Navigation/
              Selector/ Card/ SystemStatus/ Avatar/ Overlay/ EmptyMessage/ Chart/ Divider/ Text/
  icons/    (SVGs, currentColor)
  assets/logos/
```

## Gaps (genuinely absent in the file — do not invent)

- Breakpoint px thresholds: not encoded. Grid switches 6→12 cols between Mobile/Desktop; `768px`
  used above is inferred from the container scale, not confirmed.
- Drop shadows / elevation: none exist — only layer-blur and backdrop-blur.
- Icon stroke width: not standardized/traced; icons mix stroke and fill construction.
- Tooltip component: none in the file (alerts = System Status banner; toasts = Snackbar).
- Figma typo: destructive role is spelled `Desctructive` — normalize in code.
- Stray `body/*` typography variable (64px) duplicates display-2 and looks mislabeled — ignore.
