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

## Savings framing — lead with $ (net), not c/L

Decision (CLAUDE.md §7): the hero AND list lead with the dollar saving; c/L is secondary.
Evidence:

- **Evaluability.** People rely on whichever attribute is easiest to judge and avoid ones
  needing computation; a hard-to-evaluate option gets judged on the easy attribute. "$3.46"
  is instantly meaningful; "6.3c/L" needs a ×tank-size step a driver won't do.
  Source: Caviola et al., evaluability bias. https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4179876/
- **Concreteness / construal.** Dollar-off framing induces concrete, low-level (act-now)
  construal; percent-off induces abstract construal. Dollars fit the "where do I pull in
  now" decision. Source: "Dollar-Off or Percent-Off?" (Bryant).
  https://digitalcommons.bryant.edu/cgi/viewcontent.cgi?article=1106&context=mark_jou
- **Reference points sharpen magnitude judgments** — so anchor the $ ("vs area avg / your
  usual"). Source: Kreiner (2026), JBDM. https://onlinelibrary.wiley.com/doi/10.1002/bdm.70079
- **Unit pricing is underused** — ~1/3 don't understand it, ~1/3 don't bother looking — so
  c/L is a poor primary decision number. Source: Consumer Awareness/Usage of Unit Pricing.
  https://www.researchgate.net/publication/228137037
- **Counter-current (doesn't flip it):** proportion dominance — people sometimes prefer
  *relative* savings, and an absolute amount feels bigger as a larger share of the bill.
  That argues for %, not c/L; and $3–9 on a ~$90 fill is already a healthy proportion.
  Sources: Bartels (2006) https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1938519 ;
  mental accounting https://www.sciencedirect.com/science/article/abs/pii/S0167268199000037

Wrong-tank guard: label fill size ("on a ~55L fill") + keep c/L visible beneath — neutralises
the original §7 concern that full-tank $ misleads partial-fill users.

