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

_All claims paraphrased from the listed sources; see URLs for originals._
