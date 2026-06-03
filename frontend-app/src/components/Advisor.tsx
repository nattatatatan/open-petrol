import { useEffect, useState } from "react";
import { api } from "../api";
import type { AdvisorResult, StationOffer } from "../types";
import { Button, Spinner } from "./ui";

/** "Fill up now or wait?" — the timing layer on top of the cheapest-now answer
 *  (CLAUDE.md §6). Grounded: the verdict/numbers come from the deterministic
 *  engine; the LLM (if configured) only phrases them and parses free-text. */
export function Advisor({
  fuel,
  tank,
  recommended,
}: {
  fuel: string;
  tank: number;
  recommended: StationOffer;
}) {
  const [advice, setAdvice] = useState<AdvisorResult | null>(null);
  const [hidden, setHidden] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    let active = true;
    api
      .advisor({ fuel, area: "Sydney", tank })
      .then((a) => active && setAdvice(a))
      .catch(() => active && setHidden(true));
    return () => {
      active = false;
    };
  }, [fuel, tank]);

  async function ask() {
    if (!question.trim()) return;
    setAsking(true);
    try {
      const a = await api.advisor({
        fuel, area: "Sydney", tank, question: question.trim(),
        recommended_station_code: recommended.station_code,
      });
      setAdvice(a);
    } catch {
      /* keep prior advice */
    } finally {
      setAsking(false);
    }
  }

  if (hidden) return null;

  const verdictColor =
    advice?.verdict === "wait" ? "var(--color-warning)" : "var(--color-success)";

  return (
    <section className="rounded-lg border border-border bg-[color:var(--color-card-raised)] p-md">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-display text-text-secondary">
          Fill up now or wait?
        </h3>
        {advice && (
          <span className="text-xs text-text-secondary">
            {advice.source === "llm" ? "✨ AI" : "⚙ rule-based"}
          </span>
        )}
      </div>

      {!advice ? (
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <Spinner /> Reading the local price cycle…
        </div>
      ) : (
        <>
          <p className="text-lg font-semibold" style={{ color: verdictColor }}>
            {advice.headline}
          </p>
          <p className="mt-1 text-sm text-text">{advice.detail}</p>
          <p className="mt-2 text-xs text-text-secondary">
            {advice.basis}
            {advice.confidence === "low" && " · low confidence"}
          </p>

          <div className="mt-md flex gap-2">
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && ask()}
              placeholder="Ask: worth driving 5km for cheaper?"
              className="flex-1 rounded-md border border-border bg-transparent px-3 py-2 text-sm text-text placeholder:text-text-secondary focus:border-border-strong focus:outline-none"
            />
            <Button hierarchy="secondary" size="small" onClick={ask} loading={asking}>
              Ask
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
