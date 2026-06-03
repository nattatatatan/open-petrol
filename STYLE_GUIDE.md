# Smart Petrol Finder — UI/UX Style Guide

> **North Star:** *Help users make the best refuelling decision in under 3 seconds.*
>
> This is a **decision-support tool**, not a fuel-price comparison site. Users do not come here
> to browse prices. They come to answer one question: **"Where should I fill up right now?"**
> Every pixel either speeds that decision or gets out of the way.

This guide is the single source of truth for how the product *looks, behaves, and reads*. It is
deliberately opinionated. Where a feature works against the north star, this guide says so and
recommends cutting it. It is grounded in the finalized Figma design system
(`frontend/design-tokens.json`, `frontend/components-spec.json`) and stays consistent with the
foundation already shipped in code (`frontend-app/src/styles/tokens.css`, `tailwind.config.js`,
`src/components/ui.tsx`).

---

## 1. Design Principles

These are ranked. When two collide, the higher one wins.

1. **Decision > Information.** Give the answer, not a dataset. The screen's job is a verdict.
2. **Net Savings > Cheapest Fuel.** Rank on net benefit (saving − detour cost), never raw price.
3. **Glanceability > Density.** One screen, one answer. If it needs studying, it failed.
4. **Trust > Marketing.** Show the working when asked; never overstate. A wrong "cheapest" is
   worse than an honest "about the same."
5. **No Setup Required.** The product works on first open with zero typing — with exactly one
   safety exception (fuel type).
6. **Mobile First.** Designed for a phone in one hand at the forecourt, not a desktop dashboard.
7. **Safe While Driving.** Optimised for a *stationary* decision; the result is safe to re-glance
   at a red light. We never ask a moving driver to interact.
8. **Understandable in 3 seconds.** Every screen has a 3-second test. If a first-timer can't act
   correctly in 3 seconds and 0–1 taps, the screen is wrong.

**The operating rule that ties them together:** *The decision is encoded in visual hierarchy —
position, colour, highlight, weight, size — not in verbose text.* We never write "FILL UP HERE."
The winner simply **looks** like the winner.

**The learnability rule (accessibility + trust):** *Colour is never the sole carrier of meaning.*
Every colour-coded signal also carries a label or icon **and** a tap-to-reveal tooltip explaining
it. The confidence/freshness indicator is the canonical example (see §5.3, §9, §10).

---

## 2. Product Stance — What This Is *Not*

| We build | We refuse to build |
|---|---|
| A single, decisive recommendation | A ranked price table to scan |
| Net-benefit ranking (detour folded in) | A "sort by cheapest" toggle as the hero |
| A static map *for orientation* | A pannable pin-browsing map |
| One-tap navigate handoff | An in-app turn-by-turn nav |
| Progressive, inline personalisation | A setup wizard before the first answer |

### Recommended cuts (each named against the principle it serves)

- **Interactive LLM Q&A / chat box — CUT.** No natural language trigger exists at the bowser; a
  text box violates *No Setup* + *Safe While Driving* + *3 seconds*. (Already dropped in
  `CLAUDE.md`; this guide affirms it as a north-star decision, not a scope compromise. The
  grounded deterministic verdict *is* the feature.)
- **"Fill now or wait?" timing advisor — DEMOTE / DEFER.** At most a single passive, dismissible
  line shown only at high confidence. Cut it from the v1 answer hero; it taxes glanceability and
  Sydney's cycle is too irregular to present confidently. Document as deferred.
- **Interactive full map — CUT** in favour of the static strip (§7). Violates *Glanceability* +
  *Safe While Driving*.
- **Two-panel compare tool — CUT.** "Other options" is a collapsed, secondary list, never a
  side-by-side. A compare tool is the ChatGPT-paragraph experience we're beating.
- **Multi-fuel multi-select — CUT.** Single fuel, with an optional E10/U91 "cheaper compatible"
  nudge only.

---

## 3. Information Architecture

Flat and shallow by design. Depth is the enemy of a 3-second answer.

```
Answer screen  ◀── home / cold-open default (Near me now)
├─ Fuel-type first-run tap  (one time, blocks nothing else)
├─ On my way to…  (route mode — prominent opt-in, same Answer layout)
├─ Other options  (collapsed; secondary ranked list, tap to expand)
├─ See on map     (static strip → expand to full map on tap)
└─ Settings       (bottom sheet; progressive personalisation:
                   baseline · tank size · memberships · theme)
```

- **One primary surface:** the Answer screen. Everything else is a modifier of it.
- **No tab bar competing for attention.** Mode (Near me / On my way) is a single in-context
  toggle, not navigation.
- **Settings is never a gate.** It is reached *from* a good answer, to make the next answer
  better.

---

## 4. Visual Hierarchy — the Decision-Atom Model

Every Answer screen ranks information into exactly four tiers. Tier 1 must win the first glance.

| Tier | Content | Treatment |
|---|---|---|
| **1 — Verdict** | Station name · **net saving** | Bold/large; **gold** marks the winner, **green** carries the saving magnitude. Top of card, largest type. |
| **2 — Cost of acting** | Detour (`+3 min`) · distance · **confidence/freshness** | Thin, mid-grey, smaller. The confidence chip is colour + label + tooltip. |
| **3 — Proof** | Pump price `c/L` · baseline (`vs your usual`) | Quiet, `DM Mono`, secondary text colour. Present for trust, never leading. |
| **4 — Alternatives** | "Other options ▸" | Collapsed by default; a single affordance, not a list. |

**Confidence as a visual variable.** Freshness modulates Tier-1 strength:

- **Fresh (< 24h):** full treatment — gold accent, elevated card, bold verdict. "We're sure."
- **Ageing (24–48h):** verdict holds, confidence chip turns amber, passive caveat appears.
- **Stale (> 48h):** the card visibly *cools* — gold highlight muted to neutral, verdict weight
  eases, "price ~Nd old — worth confirming" shown. Still decisive, honestly calibrated.

The cooling is **never** the only signal: the confidence chip always states the age in words and
expands to a tooltip (§5.3).

---

## 5. UI / Visual Style

### 5.1 Typography

Both heading and body are `NeueHaasGrotDispRD`; numerals/captions use `DM Mono` (tabular).

**The hybrid voice (core decision):** premium ultra-thin type is the *frame*; the two decision
atoms step up to heavy. This keeps the brand's elegance while making the answer unmissable at
arm's length.

| Role | Token | Size (mob→desk) | Weight | Use |
|---|---|---|---|---|
| Display | `display-1/2` | 96 / 64 | `35Thin` (200) | Splash / rare hero numerals |
| Heading | `h1` | 42 → 46 | `35Thin` | Screen titles (sparingly) |
| Heading | `h2` | 32 → 36 | `35Thin` | Section heads |
| **Verdict — station** | `body-xl`/`h3` | 24–28 | **Medium (500)** | Winner station name |
| **Verdict — saving** | `h2`/`h1` | 32–42 | **Medium/Bold** | `SAVE $9.20`, in green |
| Body | `body-default` | 16 | `35Thin`; **Medium** for emphasis | Supporting copy |
| Body small | `body-sm` | 14 | Roman (400) | Detour, distance, labels |
| Caption / numerals | `caption` | 11 → 15 | `DM Mono` Light | Price `c/L`, timestamps |

- Letter-spacing on headings ≈ 4% (`0.04em`). Prices use `font-feature-settings: "tnum"`.
- **Never** set the verdict atoms in `35Thin` — they must survive sunlight and a glance.

### 5.2 Colour Semantics

The palette is fixed by the design system; what matters is the *meaning* we assign. Dark-forward.

| Meaning | Token | Hex (dark) | Rule |
|---|---|---|---|
| **The chosen winner** | `brand` / gold | `#F2AC59` | Reserved. Only ONE element per screen is gold — the recommendation. |
| **Saving magnitude** | `success` / green | `#78B83E` (`#5A9E1F` light) | The dollar/cent saving figure. Bigger save → it's the green number that grows. |
| **Alert / "act with care"** | `accent` orange | `#FD5422` | Ageing prices, "fill only what you need," soft warnings. |
| **Error / wrong** | `destructive` pink | `#E93C79` | Failures, invalid input, hard errors only. |
| **Body / surfaces** | grey ramp | `#000`→`#FFF` | Page `#000`, card `#18191A`, raised `#232426`. |
| Data-viz (future trends) | `viz 1/2/3` | green/purple/blue | Charts only; not decision colour. |

**Gold discipline is the whole system.** If two things are gold, nothing is the winner. Detours,
prices, and alternatives are *never* gold.

### 5.3 The Confidence Indicator (canonical color+label+tooltip pattern)

```
[ ● fresh · 12m ago  (i) ]      gold/neutral dot, plain words, tap (i)
[ ● ageing · 1d ago  (i) ]      amber dot
[ ● stale · 3d ago   (i) ]      muted dot + "worth confirming"
```

Tooltip copy (tap to reveal, dismiss on tap-away — uses `InfoTooltip`):

> *"This price was last reported by the station 3 days ago. FuelCheck shows what operators
> submit, so older prices can be wrong at the pump. We've eased our confidence and suggest
> confirming when you arrive."*

This is non-negotiable: **the colour is an accelerant, the words are the guarantee.**

### 5.4 Spacing, Radius, Elevation

- **Spacing scale (8-pt rhythm):** `xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 40 · 3xl 48 · 4xl 56`.
  Cards breathe — generous padding (`lg`/`xl`) is part of the premium feel.
- **Radius:** `default 4 · md 8 · lg 16 · xl 24 · full`. Cards = `lg`; the Navigate button & chips
  = `full`; inputs = `md`.
- **Elevation = blur, not shadow.** The system defines **no drop shadows** — only layer/backdrop
  blur (`sm 4 · 8 · md 12 · lg 16 · xl 24 · 2xl 40 · 3xl 64`). Depth comes from surface colour
  steps (`page → card → raised`) and backdrop-blur on sheets/overlays.

---

## 6. Design Tokens

Three layers; components bind **only** to the mapped layer so theming is automatic.

```
primitive (grey/gold/orange/pink/green…)   ── static
   ↓ referenced by
semantic (brand · accent · destructive · success · visualization)   ── single-mode
   ↓ referenced by
mapped (text/* · surface/* · icon/* · border/* · divider/*)   ── light + dark, themeable
```

Shipped CSS variables live in `frontend-app/src/styles/tokens.css` and are surfaced to Tailwind
in `tailwind.config.js` (`text-*`, `surface-*`, `icon-*`, `border-*`, `bg-brand`, `text-success`,
`fontSize` type ramp, `blur` scale).

**Documented divergences from raw Figma (intentional, keep):**
- `text/icon.onAction` stays **black** in both themes — our action surfaces are gold in both
  modes and black-on-gold is the legible, shipped look (Figma's dark `#FFF` would be low-contrast).
- Light theme **remaps surfaces** to be genuinely light (Figma's "light" mode surfaces are dark
  in both); `action/warning/success` use darker gold/green in light mode for contrast on white.

**Product-semantic aliases to add (so intent is named, not hardcoded):**

```css
--decision-winner:    var(--color-brand);     /* gold — the one recommendation       */
--saving-positive:    var(--color-success);   /* green — saving magnitude            */
--confidence-fresh:   var(--color-brand);
--confidence-ageing:  var(--color-warning);
--confidence-stale:   var(--color-text-bodySecondary);  /* cooled / neutral          */
--detour-cost:        var(--color-text-bodySecondary);  /* never gold, never green   */
```

Components reference these intent tokens, not raw palette values.

---

## 7. Screen-by-Screen Specifications

Layout sketches are mobile (≈ 360–390 dp wide). Thumb-zone = bottom third.

### 7.1 Cold open / Locating
```
┌──────────────────────────┐
│  (logo, small, top)      │
│                          │
│      ◌ finding the       │   skeleton AnswerCard pulses
│      cheapest near you…  │   (no blank screen, ever)
│  ▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭▭      │
│  ▭▭▭▭▭▭▭▭                │
└──────────────────────────┘
```
- Auto-requests geolocation on open. No "tap to start." 3-second test starts ticking immediately.
- If a fuel type isn't set yet, the fuel tap (7.2) shows *first*, then this.

### 7.2 Fuel-type first run (one time only)
```
┌──────────────────────────┐
│  Which fuel do you use?   │   h2, thin
│                          │
│  [ E10 ] [ U91 ] [ P95 ] │   big-button group, 56px tall
│  [ P98 ] [ Diesel ][LPG] │
│                          │
│  You can change this any  │   caption, secondary
│  time.                    │
└──────────────────────────┘
```
- The **only** upfront question — justified because showing the wrong fuel's saving is *unsafe*,
  not merely imprecise. One tap → straight to the answer. Persists forever after.

### 7.3 Answer screen — Near me now (the home screen)
```
┌──────────────────────────┐
│ Near me ▾   |  On my way  │  mode toggle (segmented)
│ ┌──────────────────────┐ │
│ │ ~~~ static map ~~~ ●  │ │  Tier-2 context, tap to expand
│ ├──────────────────────┤ │
│ │ cheapest near you     │ │  Tier-1 label, thin grey
│ │ ██ Shell Victoria Rd  │ │  Tier-1 station, Medium, (gold accent)
│ │ ██ SAVE  $9.20        │ │  Tier-1 saving, big, GREEN
│ │ 9.6c/L cheaper        │ │  primary saving framing (c/L leads)
│ │ ● fresh · 12m (i)     │ │  Tier-2 confidence chip + tooltip
│ │ 1.2km · +3 min detour │ │  Tier-2 cost of acting
│ │ 178.9c/L · vs usual   │ │  Tier-3 proof (DM Mono, quiet)
│ │                       │ │
│ │ [    NAVIGATE    ]    │ │  thumb-zone, full-radius, 60px
│ └──────────────────────┘ │
│  Other options ▸          │  Tier-4, collapsed
│  U91 · change   ⚙         │  inline refine + settings
└──────────────────────────┘
```
- **Saving framing leads with c/L** ("9.6c/L cheaper"), dollar figure as a clearly-estimated
  secondary ("≈ $9.20 off a ~55L fill"). c/L scales linearly in the head; the dollar is never a
  required input.
- One gold element (the winner). One green number (the saving). Everything else recedes.

### 7.4 Answer screen — On my way to…
```
┌──────────────────────────┐
│ Near me  |  On my way ▾   │
│ Where to? [ Parramatta  ] │  single input, then…
│ ┌──────────────────────┐ │
│ │ ~~ route + pin map ~~ │ │  static; winner pinned on the line
│ │ best stop on your way │ │
│ │ ██ BP Homebush        │ │
│ │ ██ SAVE  $7.40        │ │
│ │ +2 min vs your route  │ │  detour-from-ROUTE, not from a point
│ │ ● fresh · 25m (i)     │ │
│ │ [   NAVIGATE (adds    │ │  added as a WAYPOINT en route,
│ │    stop en route)  ]  │ │  not as the destination
│ └──────────────────────┘ │
└──────────────────────────┘
```
- Net benefit = saving vs baseline − detour cost (extra drive × consumption + a conservative,
  invisible value-of-time default). The net figure shows on **every** option, not just the winner.

### 7.5 Other options (expanded)
```
┌──────────────────────────┐
│ ‹ Other options           │
│ Shell Victoria Rd  +$9.20 │  winner repeated at top, gold
│ BP Ryde            +$6.10 │  net figures, ranked
│ 7-Eleven Top Ryde  +$4.80 │
│ Caltex (your usual)  base │  baseline anchor shown
└──────────────────────────┘
```
- A list, not a compare grid. Ranked on **net benefit**. Tapping a row makes it the active answer.

### 7.6 Settings (bottom sheet, progressive)
- Reached from the answer, never before it. Sections: **Savings baseline** (usual-station
  typeahead; defaults to area average), **Tank size** (slider, default 55L), **Memberships**
  (multi-select chips → effective price), **Theme**.
- Each setting states its effect ("Add your rewards card — a 4c/L docket can change the winner").

### 7.7 Stale / low-confidence variant
- Card cooled (neutral border, eased weight), amber/stale chip, passive "worth confirming" line.
  If confidence is too low to rank at all → fall back to "cheapest right now" with the caveat
  surfaced, never a fake prediction.

### 7.8 Stay-put / flat-prices note
- When prices are genuinely flat, the verdict still names the best reachable station (we are
  always decisive — decision #3), with an honest secondary line: *"Prices are flat nearby today."*
  We do **not** add a separate "should you bother?" decision for the user to make.

---

## 8. Component Library Requirements

Mapped to the Figma set (`components-spec.json`) and the shipped `ui.tsx`. Build only what the
flow needs.

| Component | Status | Notes |
|---|---|---|
| **Button** | ✅ shipped | `primary/secondary/destructive` + `surface`, sizes 60/40. Navigate = primary, full-width, full-radius. |
| **Input** | ✅ shipped | Default/Selected(focus=highlighted border)/Filled/Error. Used for destination + suburb + station search. |
| **FreshnessBadge / Pill** | ✅ shipped | Extend into the **Confidence chip** (color + label + tooltip). |
| **InfoTooltip** | ✅ shipped | The tap-to-explain primitive for every color-coded signal. |
| **Card** | ✅ shipped | Base for AnswerCard. |
| **AnswerCard** | 🔨 build | Composed: map strip + verdict + confidence + proof + Navigate. The hero. |
| **MapStrip** | 🔨 build | Static (non-interactive) map image + winner pin; tap → full map. |
| **FuelChooser** | 🔨 build | Big-button group (56px) for first-run + inline change. |
| **ModeToggle** | 🔨 build | Segmented Near me / On my way. |
| **MembershipChip** | ✅ partial | In SettingsSheet; align to Tag/Chip spec. |
| **BottomSheet** | 🔨 build | Settings + expandable map; backdrop-blur, drag handle. |
| Badge, Tag, Avatar, Stepper, etc. | ⏸ defer | Not on the critical path; do not build speculatively. |

All components bind to mapped/intent tokens, inherit `currentColor` for icons, and expose Figma
variant axes as enum props (per `implementation-notes.md`).

---

## 9. Mobile Interaction Patterns

- **Thumb-zone primacy.** The single primary action (Navigate) lives in the bottom third,
  full-width, ≥ 56px tall. Destructive/rare actions stay out of the thumb arc.
- **Tap, never hover.** No affordance depends on hover (no mouse at a forecourt). Hover styles
  exist only as desktop progressive enhancement via `*-action-hover` tokens.
- **Tap-to-expand, not pan.** Map and "other options" expand on tap; nothing requires a drag to
  read the answer.
- **One-tap inline refine.** Fuel, baseline, membership are each a single tap from the answer.
- **Bottom sheets** for settings and expanded map; dismiss by tap-away or drag-down.
- **Tooltips** dismiss on tap-away; never block the Navigate button.
- **No typing on the critical path** except the optional route destination.
- **Targets:** ≥ 44px everywhere; 56px for primary/in-context actions; 8px min gap between
  adjacent targets.

---

## 10. Empty, Loading & Error States

### Empty states (opportunity, not apology)
| Situation | Treatment |
|---|---|
| No stations in range | "No stations within Xkm. Widen the search?" + one-tap widen. |
| Location unavailable | Inline suburb input (manual fallback) — not a dead screen. |
| No route found | "Couldn't find that place — try a suburb or postcode." |
| No membership set | Passive nudge on the answer, never a blocking empty state. |

### Loading states
- **Never a blank screen.** Cold open → skeleton AnswerCard (`Skeleton` component) with soft
  pulse (`animate-pulse-soft`, already in `index.css`).
- Optimistic copy: *"Finding your best fill-up…"*.
- Re-fetch in the background; show last-good answer immediately with its timestamp.

### Error states (always actionable)
| Error | Behaviour |
|---|---|
| Geolocation denied | Manual suburb entry; remember the choice. |
| Geocode failed | "Couldn't find that — try again" inline, no modal. |
| Price refresh failed | Serve last-good cache **with its timestamp** + a `System Status` banner; never blank. |
| All prices stale | Decisive answer + prominent confidence caveat; offer no fake "refresh." |
| Network down | Cached answer + offline banner. |

Per `CLAUDE.md` §4: there is **no per-user refresh button** — re-polling can't fix an
operator-stale price, and per-user fetches break cache-first. The only "refresh" is the global
last-good banner.

---

## 11. Accessibility Requirements

- **Colour is never alone.** Every colour-coded signal (confidence, saving, alert) pairs colour
  with text/icon **and** a tap tooltip. This is the user's explicit requirement and the core a11y
  guarantee.
- **Contrast.** Verdict atoms are heavy weight precisely to clear WCAG AA on the dark surface.
  Audit thin type on `#000`/`#18191A`: body text uses `#FFF`/`#A8ABB0` (passes); avoid thin grey
  below `body-sm` for essential info. Saving green on dark passes; on light use `#5A9E1F`.
- **Focus.** Visible focus ring on all interactive elements — the shipped highlighted-border focus
  on inputs and `focus-visible:ring-brand` on buttons.
- **Screen-reader order = decision first.** DOM order: verdict → saving → confidence → proof →
  Navigate. Verdict region is `aria-live="polite"` so it announces when the answer resolves.
- **Reduced motion.** Honour `prefers-reduced-motion`: disable the skeleton pulse and the
  confidence "cooling" transition; show end state instantly.
- **Targets & sunlight.** 44px+ targets; high-contrast bold verdict for outdoor legibility;
  support OS dynamic type up to large sizes without truncating the verdict.
- **Labels.** All icon-only controls have `aria-label`; the confidence chip's tooltip is
  reachable by keyboard and screen reader, not hover-only.

---

## 12. Copywriting Guidelines

- **Voice:** plain, confident, Australian, numbers-forward. Like a knowledgeable mate who
  respects your time — never a salesperson.
- **Lead with the number, in the user's units.** "9.6c/L cheaper" → "≈ $9.20 off a ~55L fill."
- **Decision lexicon:** `save $X` · `+N min` · `on your way` · `worth confirming` · `vs your usual`.
- **Confidence phrasing:** "fresh · 12m ago", "price ~2d old — worth confirming at the pump."
  Never imply a stale price is current.
- **Never say:** "Cheapest!!", "Best deal ever", exclamation hype, "guaranteed", or any claim we
  can't ground in the data. Over-claiming a discount breaks trust like a stale price does.
- **Membership honesty:** when a discount is applied, say "showing your effective price with
  Everyday Rewards (+ NRMA)"; keep the pump price visible.
- **Errors:** describe the fix, not the fault. "Couldn't find that suburb — try a postcode."
- **Sentence case** everywhere except the saving figure. No ALL-CAPS shouting (the sketches use
  caps only to denote *weight*, not literal capitalisation).

---

## 13. Visual Hierarchy Quick-Reference (the 3-second test)

On any answer screen, squint. In order, you should see:

1. **A gold-marked station name + a big green saving** (the verdict).
2. **A confidence chip and a `+N min`** (what it costs you to act).
3. **A full-width Navigate button** in the thumb zone.

If anything else competes at that squint level — a price table, a second gold element, a busy map
— the screen has drifted from decision tool toward comparison browser. Fix it.

---

## 14. Responsive Behavior

- **Mobile-first.** 6-column grid, 8px gutter, 16px margin. The Answer screen is a single column;
  the AnswerCard is the full content width within the margin.
- **Breakpoint** ≈ 768px (inferred; the grid switches 6→12 columns). Above it:
  - Centre the experience in a max-width container (`md` 448 / `lg` 512); **do not** spread into a
    two-pane dashboard. The product is the same single decision, just centred with more breathing
    room.
  - "Other options" and the expanded map may sit beside the card on very wide viewports, but the
    verdict never loses primacy.
  - Responsive type shifts (system-defined): h1 42→46, h2 32→36, caption 11→15. Everything else
    fixed.
- **Touch remains the assumption** even on desktop (hover is enhancement only).

---

## 15. Future Extensibility

Each future capability is gated behind one test: **does it compromise the 3-second answer?** If
yes, it lives behind an opt-in, never in the default path.

- **Saved routes / commute prediction** — "fill up on tomorrow's drive home." Compounding hook;
  surfaces proactively only when confidence is high.
- **Price-drop alerts** — push when a usual-route station drops materially. Opt-in.
- **Multi-state** — WA FuelWatch etc. behind the same `FuelSource` interface; zero UI change.
- **EV sibling mode** — a separate mode (charger type/power isn't c/L-comparable), never mixed
  into the fuel ranking.
- **Voice handoff** — the retained (disabled) tool-use layer could re-enable behind a genuinely
  natural trigger (e.g. CarPlay voice). Numbers always come from code, language from the model.
- **Timing advisor** — may return as a single passive high-confidence line if the historical
  series proves reliable.

Extensibility principle: **add modes and depth at the edges; never add density to the verdict.**

---

*This guide governs design decisions for v1. When reality contradicts it (a real user can't decide
in 3 seconds), the guide is wrong — update it, and say why.*
