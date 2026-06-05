# Visual Language — Claude Code Guide

This document describes the *aesthetic intent* of the design system. The token and component
spec files tell you **what** the values are; this tells you **how and why** to use them so the
result actually feels like the Figma designs. Read this alongside `design-tokens.json` and
`components-spec.json`.

> **The essence in one line:** A pure-black, editorial, typographically-led fintech UI where
> ultra-thin type and generous space do the work, color is rare and deliberate, and emphasis
> comes from *inverting to white* rather than adding weight or shadow.

---

## 1. Core principles

1. **Black is the canvas, not a theme.** The default background is true black (`#000000`,
   `surface.page`) — not dark grey. Build for dark-first; light surfaces are an accent, not the base.
2. **Type is the design.** The system leans on an ultra-thin weight (`35Thin`) at large sizes.
   This thinness *is* the brand. Resist the instinct to make headings heavier — it will instantly
   look like a different product.
3. **Restraint with color.** Most of the screen is black, white, and grey. Orange/gold appears in
   small, intentional moments (badges, brand marks). Never large color fills.
4. **Emphasis by inversion, not elevation.** The most important card on a screen flips to a
   **white surface** with black text. There are no drop shadows anywhere — depth comes from
   surface color and hairline borders only.
5. **Space generously.** Screens breathe. Big margins, clear section breaks, never crowded.

---

## 2. Surface system (observed)

Layer surfaces from black upward. Cards are defined by a **hairline border**, not a fill jump.

```
surface.page       #000000   The screen. Always.
surface.primary    #18191A   Base dark cards (barely lighter than black; border does the separating)
surface.tertiary   #232426   Nested / elevated surfaces inside a card
surface.secondary  #FFFFFF   INVERTED hero card — used for the single most important moment on a screen
```

**Rules:**
- A dark card sits on black, separated by a `1px solid border.default` border — the fill barely
  changes; the border is what you see.
- Use the **white inverted card** for the primary conversion element (the offer, the result, the
  CTA moment) — at most one per screen. On it, text becomes black, the primary button becomes dark.
- No `box-shadow`. If you need separation, use a border or a backdrop-blur, never a shadow.

---

## 3. Typography — the signature

Two families, used for completely different jobs. This pairing is the most recognizable part of
the system.

### Sans (`NeueHaasGrotDispRD`) — content
- **Headings and hero numbers** use `35Thin`. Large, light, elegant. e.g. "Potential savings of
  $4,260/year" is a big thin heading, not a bold one.
- Body copy is also `35Thin` by default; only step up to `Roman`/`Medium` for genuine emphasis
  (a "strong" label, an error). **Never bold body text.**
- Secondary/supporting text uses `text.bodySecondary` (grey) at the same thin weight.

### Mono (`DM Mono`, Light) — metadata & labels
Monospace is used deliberately for anything *systematic*:
- **Section labels**, uppercase, letter-spaced, grey: `CURRENT MORTGAGE`, `WE'VE SEARCHED 10,233…`
- **Stats and measurements**: `1 YEAR FIXED 3.42%`, `173.5c/L`, `980 m · ~$0.86 to drive`
- **Badge text**: `SAVINGS ALERT`, `CHEAPEST`, `TERTIARY ACTION`

If a piece of text is data, a label, or a tag → mono, uppercase, spaced, grey.
If it's human-readable content → thin sans.

---

## 4. Color usage

```
Backgrounds / structure:  black, #18191A, #232426, white (inverted)
Text:                     white (dark surfaces) / black (white surfaces), grey for secondary
Accent (orange/gold):     badges, brand marks, small highlights ONLY
Status:                   green dot = good, orange dot = neutral/warning, pink/magenta = error
```

- Accent (`accent.default` #FD5422 / `brand.default` #F2AC59) is for **small surfaces** — pill
  badges, an icon, a single highlighted word. Never a full-width colored button or banner fill
  (the one exception is destructive/error states).
- Status indicators are small **dots** before a label (seen in the list rows), not full chips.
- Error states use the destructive/pink scale and may fill a banner — this is the one place a
  saturated fill is acceptable.

---

## 5. Spacing & density

The system is tight but not cramped — it earns its space at the section level.

- Internal element gaps: `space.sm` (8px) to `space.md` (16px).
- Card padding: `space.lg` (24px) vertical, `space.md` (16px) horizontal (matches the components).
- Between sections / cards: `space.lg`–`space.xl` (24–32px).
- Full-width content with consistent screen margins (~20px gutter on mobile).
- Metadata rows use **middot separators**: `Toowong QLD · 5.25% · $1,000,000` — not stacked lines.

---

## 6. Shape

- Border radius is **small-to-medium**: `radius.md` (8px) for cards and buttons, up to `radius.lg`
  (16px) for larger containers. This is **not** a rounded/bubbly UI — corners are subtle.
- Pills (badges, status chips) use `radius.round` (9999px).
- Borders: `1px solid border.default`. The whole separation strategy is hairline borders.

---

## 7. Component patterns (as actually composed)

- **Primary button:** full-width, ~56–60px tall, label left-aligned with a **trailing arrow icon**
  right-aligned (`View offer →`). Solid fill — white on dark screens, dark on white cards.
- **Tertiary / inline action:** text + trailing arrow, no fill, often separated from the button
  above by a divider (`Check approval odds →`).
- **Badge:** small pill, uppercase mono text, accent or neutral fill (`SAVINGS ALERT`, `CHEAPEST`).
- **Header:** back chevron left, centered thin title, optional action right.
- **List row** (see the fuel/results screen): title in thin sans, a mono metadata line with a
  leading status dot, a right-aligned value, and an `(i)` info affordance in a separate rounded
  cell beside the card.
- **Expandable card:** title + chevron; chevron rotates `180deg` when open (never a matrix transform).
- **Hero number:** the key figure (savings, score) is rendered large and thin, sometimes inside a
  circular progress ring (credit score screen).

---

## 8. Tone of voice (microcopy)

The copy is casual, confident, and data-flexing — and the UI styles it accordingly:
- System annotations brag with real numbers in mono: `WE'VE SEARCHED 10,233 PRODUCTS THIS MONTH`.
- Occasional emoji for warmth (🔥) — sparingly, in microcopy only.
- Plain-language value statements as big thin headings (`Potential savings of $4,260/year`).

When generating placeholder copy, match this: specific numbers, lowercase friendly phrasing in
content, UPPERCASE MONO for labels.

---

## 9. Do / Don't checklist for Claude Code

**Do**
- Default every screen background to black.
- Make headings large and `35Thin`.
- Use DM Mono uppercase for labels, stats, and badges.
- Reserve one white inverted card for the key moment per screen.
- Separate surfaces with hairline borders.
- Put a trailing arrow on primary/tertiary actions.
- Use middot-separated metadata rows.

**Don't**
- Don't use grey-ish "dark mode" backgrounds — it's true black.
- Don't bold headings or body text (thin is intentional).
- Don't add `box-shadow` / elevation — use borders/blur.
- Don't use large colored fills for buttons or banners (except error states).
- Don't crowd elements — keep the generous section spacing.
- Don't round corners heavily — 8px is the default, this isn't a bubbly UI.
- Don't put metadata/labels in the sans font — those are mono.

---

## 10. How to use this with the spec files

1. Read this document for *intent*.
2. Pull exact values from `design-tokens.json` (mapped layer → CSS variables).
3. Match variant axes from `components-spec.json`.
4. When the spec and your instinct disagree on *feel*, this document wins on aesthetics and the
   token file wins on values.

Reference screens observed: Offer recommendation, Home, Gas/electricity results, Approval odds,
Overview, Settings & Profile, Form wizard (SCREEN REFERENCE page, file cL8Ta4zbtIPFIMyuPkka8A).
