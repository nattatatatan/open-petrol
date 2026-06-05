# Decision: the timing advisor stays deterministic (no ML) — and what we fixed

**Status:** accepted · **Scope:** `backend/app/engine/cycle.py`, `backend/app/advisor/`
**Relates to:** CLAUDE.md §6 (AI-native feature), §7.5 (modifier on the recommendation),
§10 (historical series + cold-start), §11 (security).

## Context

"Fill up now or wait?" is the AI-native feature. It reasons over the cached **daily
area-low series** (one low price per fuel × area per day) and returns one of four
verdicts — `fill_now | fill_only_needed | wait | uncertain` — that *modify* the
finder's recommendation rather than forming a separate screen.

The open question this document settles: should that verdict come from deterministic
rules or from a learned model (logistic regression / gradient-boosted trees / a net),
given NSW FuelCheck data? And, separately, is the current deterministic engine actually
production-worthy as written?

## What we have / don't have

Have: station-level prices, per-price `lastupdated`, fuel types, locations, brands, and
an accumulating daily area-low history. Don't have: demand, transaction volume,
wholesale/terminal-gate prices, inventory, or any user refuelling behaviour. NSW pricing
follows a structured cycle (slow rise → sharp peak → sharp drop → trough), but it is
**irregular and lengthening**.

## Decision

**Keep it deterministic. Do not add ML for v1 (and likely not for v2).** The verdict is
a transparent, rule-based **4-phase cycle classifier**; the copy layer is pure
presentation. No model, no network, no key on the advisor path.

### Why ML loses here — on this data, for this problem

1. **The target is the wrong shape.** A binary classifier `P(price(t+3) > price(t))`
   optimises symmetric accuracy/log-loss. Our loss is **asymmetric**: a wrong "wait"
   right before a hike costs far more than a wrong "fill now". You'd re-impose that
   asymmetry with thresholds on top of the model — i.e. rebuild the deterministic policy
   anyway. The rules encode the asymmetry *directly and legibly*.
2. **Data volume is cycles, not rows.** ~1 supervised example per area per day, and a
   ~30–40-day cycle ⇒ only ~9–12 full cycles/year/area, with areas strongly correlated
   (shared refiners/wholesale). A model fits a handful of sawtooth periods, memorises the
   recent cycle length, and mis-predicts when the cycle lengthens — the exact failure
   §10 warns about. A "where am I in the recent range, which way am I moving" rule
   degrades gracefully through a regime change.
3. **Explainability is graded.** The `basis` string ("cheaper than 78% of the last 30
   days, risen 3 days running") *is* the trust mechanism (§4). A model replaces a
   quotable causal sentence with "score 0.62" and then needs SHAP bolted on to recover
   what the rules state exactly.
4. **No language entry point + a numeric decision.** A driver at the bowser won't type
   questions, and even with an entry point an LLM could only *re-phrase* a numeric
   verdict — buying nothing for its key/latency/cost while adding a failure mode (§6).

### Method comparison (for "classify cycle position from ~1 sample/day, explainably")

| Approach | Fit | Explainability | Data hunger | Cold-start | Maint. | Verdict |
|---|---|---|---|---|---|---|
| **Deterministic rules** | High — encodes the asymmetry directly | Perfect | None | Works at 21 days | Low | **v1 winner** |
| Logistic regression | Moderate | Good (coeffs) | Needs cross-cycle data | Dead for months | Medium | Only with years of data; marginal even then |
| XGBoost / LightGBM | Low — overfits a sawtooth on tiny n | Poor (needs SHAP) | High | Dead | High | No — the classic "trees on 12 cycles" trap |
| Neural nets / LSTM | Very low — data-starved by orders of magnitude | ~None | Very high | Dead | Very high | No |

### Where ML *would* genuinely add value (later, not now)

- **Confidence calibration** — the one real opening. With enough banked history you could
  calibrate "when I said *wait* at percentile > 75, how often did price actually drop
  ≥X within 5 days?" (isotonic/Platt on outcomes). Modest, explainable, makes the
  confidence number empirically true. Needs the history we don't have yet → **v3**, and
  it slots in behind the same decision-engine interface with **zero UI change**.
- **Phase detection / regime change** — rules win; this is precisely where a model
  trained on past cycles *hurts*. Our conservative-bias-to-`uncertain` is the mitigation.
- **Anomaly detection** — done deterministically below (robust z-score); not ML.

## Production architecture

```
NSW FuelCheck ─┐                         ┌─ SnapshotSource (demo / launch backfill)
               ├─ poll job ─ PriceCache ─┤
LiveFuelCheck ─┘                         └─ daily-low roll-up ─ DailyLow series
                                                                     │
                                              FEATURE ENGINE (cycle.py signals)
                                                                     │
                                       DETERMINISTIC DECISION ENGINE
                                       · 4-phase verdict · confidence=quality×signal
                                       · anomaly guard → uncertain
                                            │                    │
                              [ optional ML layer, v3 ]     basis string (trust)
                              calibrated confidence,
                              same interface, no UI change
                                            │
                                   ADVISOR UI (modifier strip on the recommendation)
```

## What we changed in this pass (the engine was not yet production-worthy)

The audit of the previous implementation found three real problems; all are now fixed
and covered by `tests/test_cycle.py`.

1. **Confidence measured data *quality*, not signal *strength* (P0, the important one).**
   `confidence = history × amplitude × freshness` had no term for *how strong the actual
   timing signal is*, so a barely-mid-cycle call shipped at **confidence 1.0**, and the
   `< 0.6 → uncertain` gate only ever fired on thin/flat/stale data — never on a clean
   but ambiguous signal. This directly contradicted the conservative-bias promise (§10).
   **Fix:** `confidence = data_quality × signal_strength`, where signal strength is the
   stronger of *position* (distance of the percentile from mid-range) and *movement* (the
   strongest 3/7/14-day slope, scaled to the cycle amplitude). The gate now collapses
   weak signals to `uncertain` too. *(Regression test:
   `test_clean_but_weak_signal_is_uncertain_not_overconfident`.)*

2. **Half the computed signals were decorative (P1).** `fourteen_day_trend` and
   `days_since_local_min/max` were computed, returned, and *never used in the verdict*,
   which only read percentile + 7-day trend. **Fix:** a real **4-phase model**
   (`trough / rising / peak / falling / flat`) built from every signal — percentile, the
   3/7/14-day slopes, the streaks, and days-since-extrema. The 3-day micro-slope earns
   its place catching the *turn at a sharp peak*, which the 7-day trend lags (right after
   a peak the 7-day window still straddles the pre-peak low and reads positive). A
   regression test asserts every signal is populated on a real call.
   - The turning-point detection is deliberately **asymmetric**, mirroring the product's
     risk asymmetry (§10): a **trough → `fill_now`** fires on price alone (filling cheap
     is low-regret), but a **peak → `wait`** requires the down-turn confirmed (a wrong
     "wait" before a hike is the worst outcome).
   - This also fixed a real product bug: a price climbing 7c/week at mid-range (the demo
     snapshot) was a confidence-1.0 `fill_only_needed`; it is now a correct, confident
     `fill_now` ("the cheap part of the cycle, and climbing").

3. **No data-error guard (P2).** A stuck operator price or a parse error could drive a
   verdict and inflate amplitude/confidence — detonating the trust thesis (§4).
   **Fix:** a robust **MAD z-score** anomaly check runs first; a latest low far outside
   the recent distribution forces `uncertain` with an honest basis. The threshold (5.0)
   sits well above where legitimate sharp cycle extrema land (~z 3), so it only trips on
   genuine errors. (MAD, not mean/σ, because the outlier itself would inflate σ.)

All thresholds remain policy in one place (`CycleConfig`); the `basis` is now keyed off
the **phase** so each call reads truthfully (a rise to the top is no longer described as
"mid-cycle"). Removed: the now-unused `LOW_PERCENTILE` / `HIGH_PERCENTILE` constants.

## Consequences / what's next

- v1 ships rules-only; the ML hook (calibrated confidence) is a documented, isolated
  future swap, not a rewrite.
- The advisor remains keyless and network-free on its path — the prompt-injection /
  token-cost surface an NL endpoint would add simply does not exist (§11).
- Cold-start (§10) is unchanged and still the real production risk: backfill the
  `DailyLow` series from Data.NSW history files at launch, then accumulate.
- Demo-snapshot curation (which day "today" lands on) is a *data* choice, kept separate
  from the algorithm — we never tune the rules to flatter the demo.
```
