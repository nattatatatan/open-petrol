# Smart Petrol Finder

> When you're about to drive somewhere, find the cheapest fill-up **with minimal
> detour along your way**, see exactly what you save, and tap to navigate — using
> real-time NSW FuelCheck prices.

NSW petrol prices swing 10–20c/L between stations on the same day. A weekly driver
wastes ~$100–200/year just from not knowing where to look. The decision is
time-sensitive and location-dependent — so this isn't a price browser, it's a
**"moment of refuelling" tool**. And because [research shows](./RESEARCH.md)
refuelling is *trip-integrated* (people fill up along routes they're already
driving and weigh detour-from-route, not distance-from-a-point), the primary flow
is **"On my way to…"**, not "near me".

This was built as an AI-Native Engineer assessment; the design rationale lives in
[`CLAUDE.md`](./CLAUDE.md), the behavioural evidence in [`RESEARCH.md`](./RESEARCH.md).

---

## What it does

- **Two entry points.** *On my way* (primary): set a destination → we find the
  best-value station in a corridor along your route. *Near me now* (secondary): the
  low-tank, fill-up-right-here case.
- **Ranks net of detour.** "Cheapest" means cheapest *after* the cost of getting
  there — we won't send you 14km to save 3c/L. Each option shows `+N min detour`.
- **Real savings vs an explicit baseline.** Every "$X saved" is measured against
  *your usual station* (set once — by tapping "Set usual" or a nearest-first
  typeahead) or, if unset, the *area average* — and we say which.
- **Membership-aware (optional).** Pick your cards (Everyday Rewards / flybuys / NRMA
  / RACV), edit a rate, or add a custom "−Xc at [brand]" — we apply the **single best**
  discount per station (no stacking) and rank on your **effective price**, so a 4–5c/L
  card can beat the pump-cheapest station. Auto-applied (0 taps at the pump); pump price
  stays visible. We only credit brands a program actually honours (flybuys → Reddy
  Express, not every Shell), and exclude Costco (its pump price already *is* the member
  price) — over-claiming a discount would break the same trust as a stale price.
  *The user owns the number*, which is what lets us defer stacking and docket-tracking.
- **Trustworthy by construction.** Prices show their **own** age (fresh / ageing /
  stale), stale prices are de-ranked, and the data's provenance + timestamp are
  always on screen.
- **"Fill up now or wait?" advisor.** A grounded price-cycle read on top of the
  cheapest-now answer (see [AI feature](#the-ai-feature-fill-up-now-or-wait)).
- **One tap to navigate** — opens Maps with the station as a **waypoint en route**
  to where you were already going.

---

## Architecture

```
        ┌──────────── scheduled refresh (APScheduler, in-process) ───────────┐
        ▼                                                                     │
   FuelSource ──────────►  PriceCache (SQLite)  ──────►  Recommendation engine ──►  API ──►  React (mobile-first)
   (pluggable)             our own store,                (pure, deterministic)      │
        │                  serves every request          • cheapest, net of detour  │
   ┌────┴──────────┐       • last-good on failure        • savings vs baseline   RoutingService (OSRM)
   │ SnapshotSource│       • accumulates daily lows      • per-price freshness    Geocoder (Nominatim)
   │  (demo)       │                                      • price-cycle heuristic
   │ LiveFuelCheck │                                                              Advisor: cycle engine (deterministic) → UI
   │  (proves path)│
   └───────────────┘
```

Four decisions do the heavy lifting:

1. **Pluggable `FuelSource`.** The engine talks to an interface, never to FuelCheck.
   `SnapshotSource` (a dated, captured dataset) powers the demo so it can't break;
   `LiveFuelCheckSource` proves the real API path. Swapping is one env var,
   `SOURCE=snapshot|live`.
2. **Cache-first.** A scheduled job polls the source into our SQLite store; **every
   user request is served from cache** — we never call FuelCheck per request. This
   decouples API volume from user count (the free tier is 2,500 calls/mo; a 45-min
   refresh ≈ 1,450/mo).
3. **Per-price freshness.** FuelCheck prices are operator-submitted and each carries
   its own `lastupdated`. We surface *that*, not our poll time — labelling a stale
   price "fresh" would break the whole trust-over-ChatGPT thesis.
4. **Routing is geometry only.** OSRM/Nominatim give us routes and coordinates;
   prices stay 100% from cache, so grounding is untouched.

### The FuelCheck spike (verified against current docs)

- **Auth:** OAuth2 client-credentials → bearer token (~12h, cached). `Authorization:
  Basic base64(key:secret)`.
- **Bulk fill:** `GET /FuelPriceCheck/v2/fuel/prices` returns all stations + prices
  in one call. Required headers include `apikey`, `Authorization: Bearer …`,
  `transactionid`, and `requesttimestamp` — **format `DD/MM/YYYY hh:mm:ss AM/PM`**,
  the #1 cause of 401s (handled explicitly in `LiveFuelCheckSource`).
- **Incremental:** `GET …/fuel/prices/new` for cheap polling between full refreshes.
- **Gap found:** the current v1/v2 API has **no trends/historical endpoint**. So the
  price-cycle series comes from (a) our own accumulated polls and (b) a launch
  backfill from the public Data.NSW monthly price-history files.

### The AI feature: "fill up now or wait?"

A general chatbot can answer "cheapest E10 near me" — so that's not our differentiator.
Timing advice is: it's the thing a one-shot answer structurally can't do. It's built
**deterministically — no LLM, no ML** — and that's a considered decision, not a
shortcut. **Timing is a prediction problem, not a language problem.**

1. **Deterministic cycle classifier** (`engine/cycle.py`) reads the recent daily-lows
   series and returns one of four verdicts — `fill_now` / `fill_only_needed` / `wait` /
   `uncertain` — with a confidence (`data_quality × signal_strength`, biased low) and a
   factual `basis` string that quotes the real numbers behind the call ("cheaper than
   78% of the last 30 days, risen 3 days running"). Conservative by design: Sydney's
   cycle is irregular and lengthening, so a peak→`wait` needs the down-turn confirmed,
   and any weak factor collapses the whole thing to `uncertain`.
2. **The verdict is a *modifier* on the finder's recommendation**, not a separate
   screen: `fill_now` reinforces the pick, `wait` softens it, `fill_only_needed` adds a
   "top up only" nuance, `uncertain` shows nothing (we never invent a signal).
3. **Presentation** (`advisor/service.py`) turns the verdict into one glanceable line;
   the `basis` is available on tap. The copy is a pure presentation layer over the
   numbers — it never reads as "AI thinks…".

**Why no LLM.** A driver at the bowser won't type free-text questions, so there's no
genuine NL entry point — and without one, an LLM could only re-phrase a deterministic
verdict, buying nothing for its key/latency/cost while adding a failure mode (and a
prompt-injection surface). So the advisor needs no Anthropic key and has no network on
its path. The `basis` string *is* the trust mechanism — explainable by construction,
which a model score would have to bolt SHAP onto to recover.

**Why no ML.** ML is a poor fit for this problem because the decision requires asymmetric risk handling, while binary classifiers optimise symmetric prediction accuracy and still need rule-based thresholds on top. The dataset contains relatively few independent fuel-price cycles, making models prone to overfitting recent patterns and failing when cycle behaviour changes, whereas simple rules based on recent price ranges and trends are more robust. Rule-based systems are also inherently explainable, providing clear justifications for recommendations, and since the application only requires a straightforward numeric decision rather than conversational interaction, an LLM would add cost, latency, and complexity without providing meaningful additional value.

---

## Tech stack

**Backend:** Python · FastAPI · httpx · APScheduler · SQLite · Pydantic.
**Frontend:** React · TypeScript · Vite · Tailwind (bound to the `/frontend` design
tokens) · Leaflet. **Routing/geocoding:** public OSRM + Nominatim (keyless).
**Deploy:** single Docker image — FastAPI serves the built React bundle and runs the
scheduler in-process.

---

## Run it locally

### Backend
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/seed_demo.py          # generate the demo snapshot + price history
uvicorn app.main:app --reload --port 8077
```

### Frontend
```bash
cd frontend-app
npm install
npm run dev                          # http://localhost:5180 (proxies /api to :8077)
```

Open the dev server, allow location (or type a suburb), pick a fuel, set a
destination, and search. For a production-style single-process run, build the
frontend (`npm run build`) and just run the backend — it serves `dist/` at `/`.

### Tests
```bash
cd backend && ./.venv/bin/python -m pytest -q     # 57 tests: engine, cache, cycle, route, advisor, history, live, API
```

---

## Going live

1. **FuelCheck:** register an app at <https://api.nsw.gov.au>, then in `backend/.env`:
   ```
   SOURCE=live
   FUELCHECK_API_KEY=…
   FUELCHECK_API_SECRET=…
   ```
   Capture a real dated snapshot with `python scripts/capture_snapshot.py`, then flip
   `SOURCE` back to `snapshot` for a bulletproof demo on real data.
2. **Cold-start history:** `python scripts/backfill_history.py <data.nsw_file.xlsx>`.

See `backend/.env.example`. **Keys are read from env and never committed.**

## Deploy

`docker build -t petrol . && docker run -p 8000:8000 petrol`, or push to
Railway/Render/Fly (an `render.yaml` is included). It must be an **always-on** host
so the scheduler stays warm — serverless won't keep cron alive.

---

## Deliberate cuts (naming the cut is the product judgment)

- **NSW only** (FuelCheck's coverage).
- **Single best stop** per trip; multi-stop "how much to buy at each" is future work.
- **Cut-line if time runs short:** live-API proof → advisor's LLM layer → advisor
  entirely. **Route-awareness is protected above all of these.**

## What's next

Multi-state (WA FuelWatch), saved routes → proactive "fill up on tomorrow's commute",
price-drop alerts, self-hosted OSRM for production routing, accumulating real history
for sharper cycle calls.

## Repo layout
```
backend/    FastAPI app — sources/ (FuelSource), cache/, engine/, routing/, advisor/, api/
frontend-app/   React + Vite app (the built bundle is served by the backend)
frontend/   design system spec (tokens, components) — the source for the UI
CLAUDE.md   product + architecture decisions   ·   RESEARCH.md   behavioural evidence
```
