# Research References — Fuel-Buying Behaviour

Evidence behind the product decisions in CLAUDE.md. Useful for the walkthrough
("decisions grounded in research, not assumption").

## Key finding: refuelling is trip-integrated, not a standalone errand

- Drivers choose **whether** to stop (based on tank level) and **which** station based on
  price, brand, and **excess travel distance from their optimal route** — i.e. the cost
  is detour *from a route already being driven*, not distance from a fixed point.
- Drivers' value of time is inferred from their **willingness to travel further from
  their routes for a lower price** — detour cost is a real, quantifiable trade-off.
- On longer trips, drivers **refuel along the way to the destination**.
  Source: NBER w29831, "Gas Station Choice and the Implications for Electric Charging."
  https://www.nber.org/system/files/working_papers/w29831/w29831.pdf

## Key finding: drivers barely search — convenience wins

- Tracking study of 108 drivers (40 days) found **little active search** in choosing where
  to refuel; people default to convenience.
  Source: Dorsey et al. (2019), cited in NBER w26488.
  https://www.nber.org/system/files/working_papers/w26488/w26488.pdf
- Implication: the blocker is friction, not unwillingness to save. A tool that surfaces a
  cheap option *barely off the existing route* removes that friction.

## Key finding: strong chain/habit loyalty

- Typical consumer does **~66% of fuel spending at a single chain**; rest spread across
  others.
  Source: NBER w22969, "The Response of Consumer Spending to Changes in Gasoline Prices."
  https://www.nber.org/system/files/working_papers/w22969/w22969.pdf
- Implication: comparing means breaking a convenient habit — reinforces that low detour +
  clear dollar value is what overcomes inertia.

## Prior art: route-based fuel planning exists (validates the pattern)

- Patent describes recommending refuelling stations **along a route** and **how much to
  buy at each** to reach the destination at minimum cost; off-route stops justified only
  when **savings exceed the value of the time delay**.
  Source: US Patent 9243929, "Fuel purchase planning along a route."
  https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9243929
- Implication: the net-benefit (saving − detour cost) model and tank-aware multi-stop
  optimisation are established; our v1 does the single-best-stop case, multi-stop is
  future work.

## Product takeaways (how this maps to the build)

1. Primary flow is "cheapest with minimal detour from where I'm already going," not
   "cheapest near my current point."
2. Cost primitive = added detour from route (distance × consumption, optional value-of-
   time), not raw distance.
3. Tank level gates the decision (must-stop-now vs can-wait / future trip).
4. Low detour + tangible dollar value is what overcomes habit and the no-search default.

## Loyalty / membership pricing (UX review — thread A)

- Supermarket fuel dockets are **capped at 4c/L** by an ACCC undertaking (since 2013):
  Coles+Shell/Reddy Express and Woolworths+Ampol, on a $30 spend.
  Sources: https://www.accc.gov.au/media-release/coles-and-woolworths-undertake-to-cease-supermarket-subsidised-fuel-discounts
  · https://fueldaddy.com.au/blog/fuel-loyalty-programs-australia/
- Motoring clubs: **RACV 5c/L** at EG Ampol (stackable to ~13c with Woolies + in-store
  spend); **NRMA 5c premium / 4c regular**; **RACQ 4c** at Puma.
  Sources: https://www.racv.com.au/membership/member-discounts/motoring/fuel-vouchers.html
  · https://acapmag.com.au/2025/01/best-fuel-discount-programs-in-australia/
- **7-Eleven Fuel Lock** is a different mechanic: lock the cheapest of your 5 nearest
  stores for 7 days, up to 150L, **max 25c/L** saving — a tool, not a fixed discount.
  Source: https://www.7eleven.com.au/get-to-know-us/stories/news/My-7-Eleven-App-Fuel-Price-Lock-feature-saves-Australian-drivers-when-filling-up.html
- **Costco** ~a few c/L cheaper; $65/yr membership.
- Implication: a 4–5c/L member discount (~$2.50/tank) can exceed the gap between our
  top-ranked stations, so FuelCheck *pump* price can rank the wrong winner for these
  users. → must-have honesty caveat now; effective-price modelling (brand-keyed) is a
  high-ROI stretch. 7-Eleven lock is out of scope (separate app, 7-day lock).
- **SHIPPED (stretch):** multi-select card catalog (Everyday Rewards / flybuys / NRMA /
  RACV) → engine applies the **single best** brand-tied discount per station (no stacking)
  → ranks on EFFECTIVE price; pump price stays visible. NRMA is fuel-tiered (4c regular /
  5c premium). Rates are **user-editable** and a **custom "−Xc at [brand]"** rule is
  supported.
- **Why user-editable rates (the load-bearing insight):** there is NO API for discount
  rates, for which cards a user holds, or for active dockets — that data is inherently
  private. So user input was always required; making the rate editable is a tiny
  extension. Crucially, **the user owns the number**, which is exactly why we can defer
  the stacking engine, docket tracking, and eligibility entirely (all CUT for v1) — a user
  can express a 10c docket week by bumping the rate, with zero modelling on our side.
  7-Eleven Fuel Lock is also out (different mechanic — a 7-day price lock, not a rate).
- **Anti-over-claim mapping:** Coles/flybuys → Reddy Express only (the former Coles Express
  network), NOT generic "Shell" — in the live data, OTR sites are Shell-branded but don't
  honour the docket, and not every Shell is a participating Coles Express. Claiming a
  discount that doesn't apply would break the same trust as labelling a stale price fresh
  (CLAUDE.md §4). **Costco is excluded** entirely: its FuelCheck pump price already IS the
  member price, so modelling a "Costco discount" would double-count. **RACQ deferred** —
  it maps to Puma, which is near-absent in the NSW dataset (the preset would be inert).
- Production note: the preset catalog is a small REMOTE JSON fetched once on launch (base
  rates update without a new build) — the only fetch that makes sense (the shared catalog,
  never the user's personal cards). Bundled JSON for the demo.

## EV charging (thread B)

- FuelCheck's real-time feed tags "EV" as a fuel type (our live pull returned ~900 EV
  rows) but it is **not c/L-comparable** (priced per kWh/session).
- Charger **type, plug, and power** live in a **separate, quarterly** TfNSW *EV Charging
  Locations* dataset — different unit, source, and cadence than the price feed.
  Source: https://data.nsw.gov.au/data/dataset/2-ev-charging-locations
- Implication: including EV breaks the c/L savings + detour story, the real-time
  freshness model, and the value prop (EV is about speed/availability, not price).
  → cut for v1; a sibling EV mode is future work.

## Multi-fuel vehicles (thread H)

- The common "multi-fuel" reality is **E10-or-91**: E10 is just 91 + ≤10% ethanol, and
  most petrol cars built from ~2005 are E10-compatible. E10 carries ~3% less energy, so
  "cheaper per litre" is closer to break-even on cost/km.
  Sources: https://www.nsw.gov.au/driving-boating-and-transport/e10-fuel/e10-facts
  · https://www.carsguide.com.au/car-advice/can-my-car-use-e10-ethanol-fuel-23625
- True dual-fuel (LPG) is a **shrinking ~2% niche**: autogas "cards" fell ~60% (≈500k →
  ≈200k), ~51k LPG-only cars, and no new LPG cars sold since 2018.
  Sources: https://www.goauto.com.au/news/market-insight/market-insight-2024/market-insight-the-rise-and-fall-of-lpg/2024-04-15/93585.html
  · https://www.mynrma.com.au/cars-and-driving/fuel-resources/the-story-behind-the-rise-and-fall-of-lpg
- Implication: keep fuel single-select; add an E10/91-equivalence nudge (0 clicks);
  full multi-select is unjustified (mixes units; only the 2% LPG niche needs it).

_All claims paraphrased from the listed sources; see URLs for originals._
