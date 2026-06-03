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
- **Membership-aware (optional).** Name your discount program (Woolworths / Coles /
  NRMA) and we rank on your **effective price** — a 4–5c/L card can beat the
  pump-cheapest station. Pump price stays visible, and we only credit brands a
  program actually honours (Coles → Reddy Express, not every Shell) — over-claiming
  a discount would break the same trust as a stale price.
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
   │ LiveFuelCheck │                                                              Advisor: engine → Claude (phrasing) → UI
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
Timing advice is: it's the thing a one-shot answer structurally can't do. Built in
three layers with a hard boundary — **LLM for language, code for truth**:

1. **Deterministic engine** (`engine/cycle.py`) reads the recent daily-lows series and
   returns a verdict (`fill_now` / `wait` / `cheapest_now`), position in the cycle,
   estimated $/tank saving, and a confidence. Conservative by design — Sydney's cycle
   is irregular, so we only say "wait" near a clear peak and fall back to
   "cheapest now" when the signal is weak. **This is the source of truth.**
2. **Claude** (`advisor/llm.py`) parses free-text questions and phrases the answer —
   but only over facts handed to it via a tool, with a system prompt forbidding it
   from inventing any number. Server-side key only.
3. **Presentation** shows the verdict *and its basis* (recent trend, data timestamp).

The feature works **fully without an Anthropic key** (deterministic phrasing); the
LLM is a pure enhancement for free-text, and any LLM error degrades to deterministic.

---

## Tech stack

**Backend:** Python · FastAPI · httpx · APScheduler · SQLite · Pydantic · Anthropic SDK.
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
cd backend && ./.venv/bin/python -m pytest -q     # 25 tests: engine, cache, cycle, route, API
```

---

## Going live (optional — the demo never needs it)

1. **FuelCheck:** register an app at <https://api.nsw.gov.au>, then in `backend/.env`:
   ```
   SOURCE=live
   FUELCHECK_API_KEY=…
   FUELCHECK_API_SECRET=…
   ```
   Capture a real dated snapshot with `python scripts/capture_snapshot.py`, then flip
   `SOURCE` back to `snapshot` for a bulletproof demo on real data.
2. **Advisor LLM:** set `ANTHROPIC_API_KEY` in `backend/.env` (server-side only;
   `.env` is gitignored).
3. **Cold-start history:** `python scripts/backfill_history.py <data.nsw_file.xlsx>`.

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
