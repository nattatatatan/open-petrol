import { useEffect, useState } from "react";
import { api } from "../api";
import type { AdvisorResult } from "../types";

/** Timing as a PASSIVE, glanceable signal (CLAUDE.md §6) — not a chat.
 *
 * A driver won't type questions at the bowser, so there's no natural free-text
 * trigger and we deliberately dropped the interactive LLM Q&A. This is a single
 * grounded line ("good time to fill" / "near cycle peak") you read at a glance;
 * tap it to see the basis. The verdict + numbers come from the deterministic
 * cycle engine. Hidden entirely when there isn't enough signal to be useful. */

const VERDICT_STYLE: Record<string, { icon: string; color: string }> = {
  fill_now: { icon: "⛽", color: "var(--color-success)" },
  wait: { icon: "⏳", color: "var(--color-warning)" },
  cheapest_now: { icon: "•", color: "var(--color-text-bodySecondary)" },
};

export function Advisor({ fuel, tank }: { fuel: string; tank: number }) {
  const [advice, setAdvice] = useState<AdvisorResult | null>(null);
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);

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

  // Low-confidence timing is noise at a glance — don't show a weak signal.
  if (hidden || !advice || advice.verdict === "cheapest_now") return null;

  const style = VERDICT_STYLE[advice.verdict] ?? VERDICT_STYLE.cheapest_now;

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="flex w-full items-start gap-2 rounded-lg border border-border bg-[color:var(--color-card-raised)] px-md py-3 text-left"
      aria-expanded={open}
    >
      <span aria-hidden>{style.icon}</span>
      <span className="flex-1">
        <span className="text-sm font-semibold" style={{ color: style.color }}>
          {advice.headline}
        </span>
        {open ? (
          <span className="mt-1 block text-xs text-text-secondary">
            {advice.detail} {advice.basis}
          </span>
        ) : (
          <span className="mt-0.5 block text-xs text-text-secondary">{advice.detail}</span>
        )}
      </span>
      <span className="mt-0.5 text-xs text-text-secondary" aria-hidden>
        {open ? "▲" : "▼"}
      </span>
    </button>
  );
}
