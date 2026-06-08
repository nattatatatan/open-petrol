# Walkthrough — Smart Petrol Finder

*OpenLoans "AI-Native Engineer" assessment, Brief 4A. This is the written walkthrough:
**the problem I focused on, the key product decisions I made, and what I'd do next.** It's
deliberately a decision narrative rather than a feature list — the deeper rationale lives
in [`CLAUDE.md`](./CLAUDE.md), and the behavioural evidence in [`RESEARCH.md`](./RESEARCH.md).

---

## The problem I focused on

NSW petrol swings 10–20c/L between stations on the same day, and a weekly driver loses
~$100–200/year just from not knowing where to look. The brief's load-bearing word is
**"moment."** The decision to refuel is time-sensitive and location-dependent, the
driver needs the answer *at the browser*, not a report they read at home. The 
whole UI is **one glance, one action**: the answer (go *here* → save $X) dominates, 
everything else collapses out of the way.

The decision that reorganised the whole product came from an insight: 
**people don't actually frequent the nearest or favourite station — it depends on the
route they're already driving.** The research backs this: refuelling is *trip-integrated*.
Drivers fill up along routes they're already on, and they weigh **detour from that route**,
not distance from a point. 200m off-route is nothing; 5km off-route is a real cost. That
means "cheapest near my current location" actually solves the *rarer* case. So the primary
entry point is **"On my way to…"**, and "Near me now" is the fallback for when the tank is
genuinely low. This is the sharpest differentiator from both ChatGPT and every 
radius-from-a-point fuel app (like NSW Fuel Check), and it's the thing a one-shot answer structurally can't do.

---

## Key product decisions

These are the questions the brief leaves implicit. Working through them honestly is most
of the product, so I've written them as the questions I asked and how I landed.

### "Cheapest" has to mean cheapest *net of detour* — and convenience is part of cost

A price table ranks on price; a *recommendation* ranks on net benefit. I kept asking: what
if price and distance aren't the only deciding factors? Plenty of people won't drive
5 extra minutes to save $1.50. So the ranking is **net benefit = saving vs baseline −
detour cost**, where detour cost folds in fuel burned *plus* a deliberately conservative
value-of-time. Time is a cost, not just distance — that's the honest model.

Crucially, I made the headline number the **net** saving and labelled it as such ("YOU
SAVE · AFTER DETOUR"), with a `FUEL SAVING +$1.81 − DETOUR −$1.18` breakdown beneath. My
worry was that showing a separate "cost to get there" next to a green saving would make
users re-do the maths and distrust the number — so the breakdown explicitly shows the
detour is *already* subtracted. The expanded "other options" rows show the same maths
plainly: *cheaper at the pump − fuel + time to drive there = net*.

### Savings need an explicit, *personal* baseline

"Save $X" is meaningless without a baseline. The default is **your usual station** (because
the saving should be *yours*, not generic); the fallback when unset is the **area
average** — and the UI always says which is in use. I didn't want to force people to run a
search first to set this, so the baseline can be set directly by **searching for your
regular station** in settings (a nearest-first typeahead), not only by tapping a result.

### Fuel type is one choice, on purpose

This is safety-relevant: showing E10 savings to a car that needs 95 is *actively wrong*. So
fuel type is the one upfront question, it persists, and every saving/verdict is scoped to
it. I considered making it multi-select for cars that take more than one grade — but for v1
I kept it restricted to one, because a single unambiguous "your fuel" is safer and simpler
than a set the user has to disambiguate at a glance. EV is excluded entirely: NSW publishes
charger type/kW but not a price, and kWh isn't c/L-comparable, so folding it in would break
the one honest comparison the app makes. (Both are noted as future work below.)

### Memberships, because the pump price often isn't what *you* pay

A 4–5c/L loyalty discount can make a "pricier" station genuinely cheaper for the
cardholder, so ranking purely on pump price would give some users the wrong answer. The
model: pick your cards (Woolworths/Coles/NRMA/RACV), and — because people hold more than
one and have one-off dockets — it's **multi-select**, with an **editable rate** and a
**custom "−Xc at [brand]"** rule for anything off-catalog. I apply the *single best*
discount per station (no stacking), rank on **effective price**, and keep the pump price
visible. I only credit brands a program actually honours, and exclude Costco (its pump
price already *is* the member price) — over-claiming a discount breaks the same trust as a
stale price. *The user owns the number*, which is what lets me defer stacking/docket-
tracking without lying. It's auto-applied, so it's zero taps at the bowser; the "how it
works" explanation sits in a tooltip rather than cluttering the main screen.

### Tank size is a typed integer, not a step-5 slider

I shipped a slider first and it was wrong. Real tanks don't land on neat 5L steps — a
Mazda CX-5 is 56–58L, a Corolla is 43L — so a step-5 slider locks those drivers out and
forces a guess, and a 3L error throws off every cost/range figure. Precision-dragging a
thumb on mobile is also just bad. So tank size is a **direct integer input** (bounded,
sane default 55L). It's a small control, but it's exactly the kind of detail that decides
whether the saving figure is trustworthy. The fill size is labelled everywhere ("on a
~55L fill") so the per-fill number is never silently wrong for a different tank.

### Trust by construction

It's a savings product, so trust is graded, and it's where I spent the most invisible
effort:

- **Freshness is per-*price*, not per-fetch.** FuelCheck prices are operator-submitted;
  each carries its own `lastupdated`. A station's price can be days old even when our poll
  ran two minutes ago. I surface the *price's* age (fresh < 24h / ageing 24–48h /
  stale > 48h), and de-rank ageing/stale prices. Labelling a stale price "fresh" would
  detonate the whole trust-over-ChatGPT thesis.
- **Show the prices, not just a magic answer** — the pump price the saving rests on is
  always on screen to sanity-check.
- **Graceful degradation** — if a refresh fails, serve last-good cache with its timestamp
  and a banner, never a blank screen.
- **Never fake a saving** — if nothing nets ahead after detour, say "cheapest/nearest"
  honestly rather than invent a dollar figure.

### The Advisor feature

The "fill up now or wait?" advisor was the decision I went back and forth on most. My
honest reaction as a user was: the timing rationale can read as weak, and a chatty LLM
"ask" here feels unnatural — a driver at the browser isn't going to type questions. So I
nearly cut it. What I concluded instead:

- **There's no genuine natural-language entry point, so there's no LLM.** An LLM could only
  *re-phrase* a deterministic verdict — buying nothing for its key/latency/cost while
  adding a failure mode and a prompt-injection surface. **Timing is a prediction problem,
  not a language problem.** So the advisor is fully deterministic (`engine/cycle.py`), needs
  no Anthropic key, and has no network on its path. (Full method comparison —
  rules vs logistic regression vs XGBoost vs nets — in
  [`docs/advisor-decision.md`](./docs/advisor-decision.md).)
- **It's a quiet *modifier* on the recommendation, not a screen or a chat.** It returns one
  of `fill_now | fill_only_needed | wait | uncertain`, with a confidence
  (`data_quality × signal_strength`, biased low) and a factual `basis` string that quotes
  the real numbers ("cheaper than 78% of the last 30 days, risen 3 days running"). That
  basis *is* the trust mechanism. `fill_now` reinforces the pick, `wait` softens it,
  `uncertain` shows **nothing** — I'd rather say less than guess.
- The bias is deliberately conservative because Sydney's cycle is irregular and
  lengthening: a confident-but-wrong "wait" right before a hike is the worst outcome, so a
  trough→`fill_now` fires on price alone but a peak→`wait` needs the down-turn confirmed,
  and an anomaly guard forces `uncertain` on bad data.

I treated this as the AI-native judgment most worth getting right: **use AI heavily to
build fast, but don't put an LLM on the critical path where it only adds risk.** LLM for
language, code for truth. And in the cut-line, route-awareness ranks *above* the advisor —
I'd cut the clever feature before the flow that matches how people actually refuel.

---

## How it's built

- **Pluggable `FuelSource` + cache-first.** The engine talks to an interface, never to
  FuelCheck. `SnapshotSource` (a dated, committed dataset) powers a demo that can't break
  or hit rate limits; `LiveFuelCheckSource` proves the real path. Swapping is one env var.
  A scheduled in-process job polls into a SQLite store and **every user request is served
  from cache** — never a per-user API call. This decouples API volume from user count: the
  free tier (2,500/mo) is a prototype limit; a 45-min refresh is ~1,450/mo, so production
  pays for *freshness/SLA*, not scale.
- **The FuelCheck spike and the gap I found.** I verified auth (OAuth2 → ~12h bearer), the
  bulk prices endpoint, and the `requesttimestamp` format that's the #1 cause of 401s. The
  key finding: **no trends/historical endpoint exists**, which is why the cycle series comes
  from accumulated polls + a launch backfill from Data.NSW history files.
- **Routing is geometry only.** OSRM (routes) and Nominatim (geocoding) are keyless and
  give *geometry* — prices stay 100% from cache, so grounding is untouched. The corridor
  search is cheap by design: buffer the polyline, shortlist by perpendicular distance, then
  run a precise via-route detour only for the top few candidates. Navigate adds the station
  as a **waypoint en route** to the real destination, not as the destination.
- **One deployable monolith.** A multi-stage Docker image builds the React bundle, then
  FastAPI serves it *and* runs the scheduler in-process — one always-on host, one
  `/api/health` check, snapshot committed so it self-seeds. **57 backend tests** cover the
  load-bearing logic (net-of-detour ranking, per-price freshness, the cycle classifier's
  conservative fallbacks + anomaly guard, membership effective-pricing) including
  regression tests for real bugs found along the way.

---

## What I'd do next

Roughly in priority order:

- **Multi-fuel cars.** Let a car that genuinely takes more than one grade hold a small set
  and compare across them — without losing the safety of an unambiguous default.
- **EV charging.** NSW publishes charger type and kW but no price; I'd add a *separate*
  EV mode (cost per kWh / per session) rather than forcing it into a c/L comparison.
- **"Convenience" beyond time.** Factor in how easy a station is to pull into (same side of
  the road, easy on/off) — drivers trade money for hassle, not just minutes.
- **Stronger stale-price actionability.** Right now stale prices are flagged and de-ranked;
  next I'd let the user *do* something about it (report/refresh a price, or filter them out).
- **Saved routes** → proactive "fill up on tomorrow's commute" — advice *across* trips,
  which a chatbot can't give — plus optional **filter by brand**.
- **Multi-state** (WA FuelWatch, etc.) behind the same `FuelSource` interface, and
  **self-hosted OSRM** for routing SLA.
- **Calibrated advisor confidence** — the one place ML genuinely earns its keep, once
  enough real history is banked (documented as a v3 hook that slots in with zero UI change).
- **Smaller polish:** a subtle terminal-style type-on of the `fill_now` verdict, and making
  the c/L price even more prominent for the users who decide on per-litre price directly.

---

*Demo: the deployed link / screen recording is at the top of the [README](./README.md).
Everything here runs on the committed snapshot — no keys, no network on the critical path.*
