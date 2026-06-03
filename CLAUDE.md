# CLAUDE.md — Smart Petrol Finder

## Project

We're building a **Smart Petrol Finder** — Brief 4A from the OpenLoans "AI-Native
Engineer" product assessment. When a user is about to refuel, the app surfaces the
cheapest petrol stations near their location (or regular route) using real-time NSW
prices, and shows the **saving per litre and estimated saving per fill-up** so the
value is immediately tangible.

This is an assessment, not just an app. Every decision is also a signal about how we
think and work — optimise for both a working product and a defensible decision trail.

## The user problem (the brief)

Petrol prices vary 10–20c/L between stations in the same area on the same day. A weekly
driver wastes ~$100–200/year purely from not knowing where to look. The decision is
**time-sensitive and location-dependent** — the user needs the right info at the moment
they're about to fill up, not a general report. That "moment of refuelling" framing is
the product. Don't drift into a generic price browser.

## What's being assessed (north star — weigh every decision against these)

- **Product thinking** — did we understand the user problem and solve it well?
- **Design craft** — is the experience clear, simple, and trustworthy? Frontend
  instructions and the design system live in `/frontend`. Read and follow them.
- **Engineering quality** — robust, well-structured, production-minded.
- **AI-native approach** — use AI to move faster (scaffolding, tests, docs) AND ship a
  grounded AI product feature.
- **End-to-end ownership** — problem → shipped. Deployable link + clean repo + walkthrough.

## Scope & constraints

- **Depth over breadth.** Core flow = *about to drive somewhere → cheapest fill-up with
  minimal detour along my way → here's what I save → navigate.* "Near me now" is the
  secondary low-tank case. (See §7.5 — route-awareness is the primary behaviour.)
- **NSW only for v1** (FuelCheck covers NSW + ACT). State this as a deliberate cut.
- **EV charging excluded from v1** (UX review): FuelCheck's "EV" isn't c/L-comparable and
  charger type/power live in a separate quarterly dataset — a sibling EV mode is future
  work. State this as a deliberate cut.
- Deliverables: working build (deployed link or screen recording) + GitHub repo +
  5–10 min walkthrough of decisions.

## Architecture decisions (already made — follow these)

### 1. Data source: NSW FuelCheck API
- Real-time NSW fuel prices via Transport for NSW / Data.NSW FuelCheck. Free tier:
  **2,500 calls/month**.
- **Verify exact endpoints, OAuth token flow, the bulk "get all prices" endpoint, and
  the incremental-update pattern against the current FuelCheck docs before building.**
  Do not assume — check.

### 2. Cache-first: poll, don't call per user
- NEVER call FuelCheck on a per-user-request basis. A scheduled job pulls the dataset on
  an interval into our own store; user queries are served entirely from our cache.
- This decouples API call volume from user count — the whole point. At a 15-min refresh
  ≈ 2,900 calls/month (just over free tier → production needs the paid tier for
  *freshness/SLA*, not for user scale). Use a 30–60 min refresh in dev to stay well
  under the cap.

### 3. Pluggable data adapter
- The recommendation engine talks to a `FuelSource` interface, NOT to FuelCheck directly.
- Two implementations behind the same interface:
  - `SnapshotSource` — reads a dated, captured JSON dataset. **The demo runs on this**
    (can't break, no rate limits, no blocked requests).
  - `LiveFuelCheckSource` — hits the real API. Build it to prove the path; show it
    pulling live data in the walkthrough; the demo never depends on it.
- Swapping sources must be a one-line change with zero downstream impact.

### 4. Trust & transparency (it's a savings product — trust is graded)
- Show the underlying prices, not just a magic answer. Show saving per litre and per
  fill-up, and let the user see why a station won.
- **Freshness is per-PRICE, not per-fetch.** FuelCheck prices are operator-submitted;
  each price carries its own `lastupdated`. A station's price can be hours/days old even
  when our poll ran 2 min ago. Surface the **price's `lastupdated`**, NOT just our poll
  time — labelling a stale price as "fresh" detonates our entire trust-over-ChatGPT
  thesis. (Verify `lastupdated` behaviour against live data; design for it regardless.)
- **Define stale thresholds + visual language.** e.g. fresh < 24h, "ageing" 24–48h,
  "stale" > 48h — flag ageing/stale prices visibly and de-rank or caveat them. Pick the
  thresholds explicitly; this is exactly the trust detail-work being graded.
- Degrade gracefully: if a refresh fails, serve last-good cache with its timestamp and a
  banner — never a blank screen.
- **Stale prices: caveat, don't offer a fake fix (SHIPPED).** An ageing/stale recommended
  station shows a passive "This price is N old — worth confirming at the pump" line. We
  deliberately offer **no per-user refresh button**: re-polling can't fix an *operator*-
  stale price (the operator just hasn't resubmitted), and per-user fetches would break
  cache-first (§2) and the rate cap. The only valid "refresh" is the global last-good
  banner above (our cache failed). "Report wrong price" → Fair Trading is future work.

### 5. Location-aware
- Core primitive is "cheapest near me." Use geolocation with a manual location fallback.
  `stationId` + lat/lng are first-class fields.

### 6. "Fill up now or wait?" — timing as a passive glanceable signal (UX review)
- Layered on the always-available "cheapest now" core. Simple, explainable cycle
  heuristic — NOT ML. The deterministic engine (source of truth) computes the verdict;
  the UI shows **one passive, glanceable line** ("good time to fill" / "near cycle peak —
  fill only what you need"), tap to see the basis. Hidden entirely when confidence is low.
- **Interactive LLM Q&A is DROPPED for v1 (UX review decision).** A driver at the bowser
  won't type questions — there's no natural free-text trigger, and a text box is an
  attention/safety cost we can't justify. Per the LLM-earns-its-keep test, without a
  natural NL entry point the LLM would just template a deterministic verdict with a key
  attached — so we don't ship it. The grounded deterministic signal *is* the feature.
  (The Claude tool-use layer is built and retained server-side, disabled, to re-enable
  behind a genuinely natural trigger later, e.g. voice. Numbers always come from code.)
- Needs a HISTORICAL daily-lows series (current v1/v2 API has no trends endpoint). See §10.

### 7. Product model — the decisions the brief leaves implicit (DON'T skip)
- **Savings baseline (load-bearing).** "Save $X" is meaningless without a baseline.
  Default baseline = **the user's usual station** (set once); fallback when unset =
  **area average**. Never an unanchored number. State which baseline is in use, in the UI.
- **Fuel type is first-class and persistent.** It's safety-relevant — showing E10 savings
  to a car that needs 95 is actively wrong. User selects fuel type once; it persists; all
  savings/advice are scoped to THEIR fuel. Lock the fuel-code set as a known closed list
  (E10, U91, P95, P98, DL, PDL, LPG, …; note FuelCheck includes EV charging as a "type").
- **"Cheapest" means cheapest NET OF DETOUR.** Don't send someone 14km to save 3c/L.
  Fold `worth_driving` into the core ranking (sort option or a flag on far-but-cheap
  stations), not just the advisor. A price table ranks on price; a recommendation ranks
  on net benefit.
- **Minimal user model:** fuel type, tank size (default 55L, editable), optional home/
  usual station (the baseline). This is what makes the saving THEIRS, not generic.
  *(SHIPPED — thread D: the usual station can be set either by tapping "Set usual" on the
  recommendation OR via a nearest-first typeahead in settings, so anchoring the baseline
  never requires running a search first. `GET /api/stations/search`.)*
- **Savings framing — lead with c/L (UX review).** Show the per-litre difference as the
  primary, unambiguous figure ("9.6c/L cheaper"); the dollar amount is a clearly-labelled
  estimate ("≈ $X off a ~55L fill"). c/L scales linearly in the head (half a tank = half
  the saving) and avoids the naive-halving + wrong-tank traps. Never a mandatory input.
- **Loyalty/membership honesty (UX review, RESEARCH.md).** FuelCheck publishes PUMP
  prices; member/docket discounts (RACV/NRMA ~5c, Coles/Woolies ~4c, Costco) are 4–5c/L
  and can exceed the gap between our top stations — so our "cheapest" can be wrong for
  those users. v1 must show a one-line caveat (zero clicks). Modelling effective price
  (brand-keyed, one optional one-time setting) is a high-ROI STRETCH, not must-have.
  *(SHIPPED — thread A: multi-select card catalog (Everyday Rewards / flybuys / NRMA /
  RACV) served as JSON (`GET /api/catalog`; bundled now, remote-on-launch in prod so base
  rates update without a new build). Engine applies the **single best** brand-tied
  discount per station (NO stacking) → effective price → ranks on it; NRMA is fuel-tiered
  (4c regular / 5c premium). Rates are **user-editable** and a **custom "−Xc at [brand]"**
  rule is supported — because there's no API for which cards a user holds, their dockets,
  or rates, **the user owns the number**, which is exactly what lets us defer stacking,
  docket-tracking & eligibility. Auto-applied per station; **0 taps at fill time**. Pump
  price stays visible — never hidden. **Trust guard:** presets only map brands a program
  demonstrably honours — flybuys → Reddy Express ONLY, not generic Shell (e.g. OTR sites
  are Shell-branded but don't take the docket); over-claiming a discount breaks the same
  trust as a stale price. **Costco excluded** (its FuelCheck pump price already IS the
  member price — a "discount" would double-count); **RACQ deferred** (Puma near-absent in
  NSW data). Explicit cuts: stacking engine, docket tracking, 7-Eleven Fuel Lock. The
  caveat copy switches to "showing your effective price with X (+ Y)" when set.)*
- **Multi-fuel: single-select + an E10/91 nudge (UX review).** Keep fuel single-select.
  The common multi-fuel case is E10-or-91 (E10 = 91 + ethanol; most post-2005 cars take
  both, but E10 is ~3% less efficient) — surface the cheaper compatible option honestly
  at zero clicks (STRETCH). Full multi-select is CUT (mixes units; LPG dual-fuel is a
  declining ~2% niche).

### 7.5 Route-aware: "On my way" mode (PRIMARY flow — grounded in RESEARCH.md)
Research confirms refuelling is trip-integrated: drivers fill up along routes they're
already driving, weigh **detour from route** (not distance from a point), barely search,
and default to convenience. So "cheapest near my current location" solves the rarer case.
Build TWO entry points:
- **"Near me now"** — low-tank / need-it-now standalone stop (the existing radius flow).
- **"On my way to…"** (primary) — user sets a destination or picks a saved route; find
  the best-value fill-up along the way.

How "On my way" works:
1. Compute the route (+ alternates) origin→destination. Search space = a **corridor**
   around the route polyline, not a radius around a point.
2. **Cost primitive = added detour**, not distance: extra driving to divert + rejoin ×
   fuel consumption **plus a conservative default value-of-time** (UX review — a smart
   default, no setting; kept low so we under-penalise detours). 200m off-route ≠ 5km.
3. Rank on **net benefit = saving vs baseline − detour cost**. This is `worth_driving`
   generalised from detour-from-point to detour-from-route (same math). **Show the
   net-of-detour figure on EVERY option** (not just the winner) so comparisons are honest.
4. Show spatially + temporally: route + candidate pins, winner annotated "+3 min · save
   $7.20", and where along the trip it falls.
5. **Navigate adds the station as a WAYPOINT** en route to the real destination — not as
   the final destination.

Tank-level layer (optional, high value): tank low → must-stop-this-trip (only stations
reachable before empty); tank fine → "don't stop today; best value on your usual commute
is X — grab it tomorrow" (advises across trips — a chatbot can't).

Saved routes (compounding hook): save "home→work"; enables proactive "fill up on
tomorrow's commute" and ties the savings baseline to the usual route.

Engineering: routing/directions API is geometry only — prices still come from cache,
grounding untouched. Use OSRM (free public/self-host) or GraphHopper (no key) over keyed
Mapbox. Cheap corridor approx: buffer polyline, spatial-filter by perpendicular distance
to shortlist, then precise via-route only the top few candidates (don't via-route all).
v1 cut: single destination, single best stop; multi-stop "how much to buy at each"
(road-trip optimisation) is future work.

### 8. Design principles (you are the designer — this is graded)
- **Mobile-first, non-negotiable.** Use context = phone at the bowser. Design narrow-
  viewport first; desktop is secondary.
- **Least clicks; smart defaults over settings (UX review).** Auto-request location on
  open so "near me now" answers with ~0 taps; remember the last fuel; infer the baseline
  (area average) so setup never blocks. The only things left explicit are what we truly
  can't infer (destination, memberships). Every new idea must justify its click/attention
  cost or become a default.
- **One glance, one action.** The answer (go *here* → save $X on your tank) visually
  dominates; the comparison list is secondary. Do NOT build a cluttered two-panel
  compare tool — that's the ChatGPT-paragraph experience we're beating.
- **Close the loop with action.** One-tap "Navigate" (open Apple/Google Maps). A
  recommendation you can't act on is just data.
- Follow the design system in `/frontend`; build only the components the flow needs.

### 9. Deploy reality (plan for it NOW — "didn't ship" is the #1 take-home failure)
- The scheduled refresh needs an **always-on process** (APScheduler etc.). Typical
  frontend hosts (Vercel/Netlify) are serverless and won't keep cron warm → backend goes
  on an always-on host (Railway/Render/Fly), frontend separate, CORS configured. That's
  two deploy targets. Accept this knowingly, or use a single deployable monolith. Decide
  early; budget time for it.

### 10. Historical series + production cold-start
- Demo: seed the daily-lows series from public Data.NSW price-history files via
  `SnapshotSource`. **Confirm those files are DAILY resolution** — a cycle heuristic needs
  daily granularity to see the sawtooth; monthly aggregates are useless for it.
- Production: `get_historical_lows` derives from accumulated polls — but on day 1 there
  is ZERO history, so the advisor is dead for weeks. Mitigation: **backfill from the
  Data.NSW history files at launch**, then accumulate. Document this.
- Heuristic honesty: Sydney's cycle is irregular and has lengthened; "position in range"
  can say "wait" right before a hike. Bias conservative, present as "based on the recent
  trend" (not a prediction), and define the `confidence:low` threshold that triggers the
  "cheapest right now" fallback.

### 11. Security hardening (cheap, reads as rigor)
- NL advisor endpoint is a public-facing LLM call: short max_tokens, one call per
  question, scope-limiting system prompt, basic length cap / rate guard against
  injection + cost abuse.
- Geocoding for manual-entry fallback (suburb → lat/lng): use Nominatim/OSM (no key).


- All frontend/design instructions and the design system are in `/frontend`. Read this
  first and match it — design craft is explicitly graded.

## Build order (de-risk first)
1. Spike FuelCheck: auth + pull real prices for a coordinate. Confirm bulk endpoint and
   limits against current docs.
2. Capture a dated snapshot dataset; build `SnapshotSource` + the `FuelSource` interface.
3. Recommendation engine: nearest stations, cheapest by fuel type, saving per litre +
   per fill-up.
4. Caching layer + scheduled refresh (so dev mirrors production).
5. UI per `/frontend`: the "about to refuel" hero, ranked stations (map/list), trust
   elements (visible prices, freshness timestamp).
6. AI feature, grounded in cached data.
7. Edge cases (location denied, stale data, no nearby stations), deploy, README, tests.

## Walkthrough talking points (capture decisions as we build)
- Why the "moment of refuelling" framing drove the product.
- Cache-first design: API volume decoupled from user count; free tier is prototype-scale;
  production needs the paid tier for *freshness/SLA*, not for scale.
- Pluggable adapter + snapshot: bulletproof demo while proving the real live path.
- Trust choices: visible prices, freshness timestamps, graceful degradation.
- Deliberate cuts: NSW only, one flow — naming the cut IS the product judgment.
- What's next: multi-state (WA FuelWatch etc.), route-aware pricing, price-cycle
  prediction, price-drop alerts.

## Cut-line / triage (apply "depth over breadth" to the plan itself)
The full scope is ambitious for 7 days solo. Define the **must-have demoable slice** and
protect it; everything above it is cuttable in priority order.
- **Must-have (protect at all costs):** "near me now" + "on my way" route mode, for the
  user's fuel type, grounded with visible prices + per-price freshness, dollar saving vs
  a stated baseline, **ranked net of detour**, one-tap navigate (waypoint en route),
  mobile, deployed, README.
- **Cut order if behind:** (1) live-API proof → demo on snapshot only and *describe* the
  live path; (2) AI advisor's LLM layer → heuristic-only (drop the key, don't fake it);
  (3) the timing advisor entirely. **Route-awareness ranks ABOVE the advisor** — it's
  closer to verified user behaviour and a sharper differentiator from both ChatGPT and
  generic radius-from-point fuel apps. Cut the advisor before cutting route mode.
- Rule: a smaller thing shipped, deployed, and polished beats a bigger thing half-done.

## Walkthrough is a graded deliverable (not a day-7 afterthought)
Capture decisions AS we build. Story arc: the problem framing → the FuelCheck spike and
the API-gap discovery (no trends endpoint) → the trust boundary (per-price freshness;
"LLM for language, code for truth") → deliberate cuts and why → what's next. This is
where the strongest material lives; don't reverse-engineer it at the end.


- Ask before any irreversible action, before installing paid services, or before
  anything needing the user's accounts, API keys, or credentials.
- Keep the repo clean and the commit history legible — it's part of what's reviewed.
