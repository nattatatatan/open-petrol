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
- Show the underlying prices, not just a magic answer. Lead with the dollar saving and
  show c/L beneath it (see §7 framing), and let the user see why a station won.
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

### 5. Location-aware
- Core primitive is "cheapest near me." Use geolocation with a manual location fallback.
  `stationId` + lat/lng are first-class fields.

### 6. AI-native product feature — "Fill up now or wait?" advisor (DECIDED: deterministic, no LLM/ML)
- **Timing is a prediction problem, not a language problem — we use an explainable
  rule-based cycle classifier; generated copy is a pure presentation layer. No LLM/ML.**
  The classifier (`backend/app/engine/cycle.py`) reasons over the cached daily area-low
  series and returns one of four verdicts — `fill_now | fill_only_needed | wait |
  uncertain` — the confidence it reached them with (0..1, biased LOW), the signals
  (7-/14-day trend, percentile in a 30-day window, days since local min/max, streaks),
  and a factual `basis` string that always quotes the real numbers that drove the verdict.
  That basis IS the trust mechanism; it never reads as "AI thinks…".
- **Why no LLM here.** A driver at the bowser won't type free-text questions, so there's
  no genuine NL entry point — and without one, an LLM would only re-phrase a deterministic
  verdict, buying nothing for its key/latency/cost while adding a failure mode. So we
  dropped the language layer entirely (rather than fake its value) — see the deleted
  `advisor/llm.py`. The advisor needs no Anthropic key and has no network on its path.
- **Integration (see §7.5): the verdict is a MODIFIER on the finder's recommendation,
  not a separate screen.** `fill_now` reinforces the picked station, `wait` softens it
  ("cheapest today, but prices look high — consider waiting"), `fill_only_needed` adds a
  "top up only" nuance, and `uncertain` shows nothing (never invents a signal). Surfaced
  inline on the result, glanceable, with the basis available on tap.
- Conservative bias is deliberate (CLAUDE.md §10): Sydney's cycle is irregular and
  lengthening, so a confident-but-wrong "wait" before a hike is the worst outcome —
  confidence is a product of independent data-quality factors (enough history, detectable
  amplitude, fresh data) so any weak factor collapses it to `uncertain`.
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
- **Savings framing: LEAD WITH $ (net), c/L SECONDARY — applied to BOTH hero and list.**
  (Reverses the earlier "lead with c/L" call — evidence-based, see RESEARCH.md.) A dollar
  amount is immediately *evaluable* and primes concrete "act now" thinking; c/L needs a
  mental ×tank-size step a driver won't do, and public comprehension of per-unit pricing
  is low. The list MUST lead with the **net $ after detour** (c/L can't express detour
  cost at all). Format, consistently:
    Hero:  `save $3.46`  /  `6.3c/L cheaper · ~55L · vs area avg`  /  `+2 min · $0.50 to get there`
    Row:   `Metro Padstow  save $2.86`  /  `+1 min · 166.7c/L · 5.5c/L cheaper`
  **Wrong-tank guard (why §7's original c/L concern is handled, not ignored):** always
  label the fill size ("on a ~55L fill") and keep the c/L line visible directly beneath —
  the unit-true number sits right where a careful user looks, so the $ motivates without
  misleading. Adjustable fill size later removes the trap entirely. Percentage is an
  optional flourish; c/L is never the lead.

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
   fuel consumption (optionally value-of-time). 200m off-route ≠ 5km off-route.
3. Rank on **net benefit = saving vs baseline − detour cost**. This is `worth_driving`
   generalised from detour-from-point to detour-from-route (same math).
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
- The advisor is deterministic (§6) — no LLM call, no public-facing prompt, so the prompt-
  injection / token-cost attack surface that an NL endpoint would add simply doesn't exist.
  The `/advisor` endpoint takes only typed params (fuel/area/tank/station) and reads from
  cache; keep its inputs validated and bounded like the rest of the API.
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
