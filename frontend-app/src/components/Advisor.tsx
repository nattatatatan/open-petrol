import { useEffect, useState } from "react";
import { api } from "../api";
import type { AdvisorResult, Verdict } from "../types";

/** Timing verdict as a MODIFIER on the recommendation (CLAUDE.md §6, §7.5) — not a
 *  separate screen and not a chat.
 *
 *  A deterministic cycle classifier (backend) returns one of four verdicts; this strip
 *  sits directly under the answer and adjusts how confident we sound about filling here
 *  now:  fill_now reinforces · wait softens · fill_only_needed adds a "top up only"
 *  nuance · uncertain shows nothing (we never invent a signal).
 *
 *  Presented in the house caption style (brand ring mark + DM-Mono uppercase, per the
 *  provided design): one glanceable line you read at the bowser; tap for the factual
 *  basis — the real numbers behind the call. */

const VERDICT_COLOR: Record<Exclude<Verdict, "uncertain">, string> = {
  fill_now: "var(--color-success)",
  wait: "var(--color-warning)",
  fill_only_needed: "var(--color-text-body)",
};

export function Advisor({
  fuel,
  tank,
  recommendedCode,
}: {
  fuel: string;
  tank: number;
  recommendedCode: string | null;
}) {
  const [advice, setAdvice] = useState<AdvisorResult | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setAdvice(null);
    api
      .advisor({ fuel, area: "Sydney", tank, recommended_station_code: recommendedCode })
      .then((a) => active && setAdvice(a))
      .catch(() => active && setAdvice(null));
    return () => {
      active = false;
    };
  }, [fuel, tank, recommendedCode]);

  // Not enough signal to time it -> stay silent rather than show a weak guess.
  if (!advice || advice.verdict === "uncertain") return null;

  const color = VERDICT_COLOR[advice.verdict];

  return (
    <button
      onClick={() => setOpen((v) => !v)}
      className="flex w-full items-start gap-3 px-1 text-left"
      aria-expanded={open}
      aria-label={`Price timing: ${advice.headline}. Tap for the basis.`}
    >
      <BrandMark className="mt-px shrink-0" style={{ color }} />
      <span className="min-w-0 flex-1">
        <span className="cap block" style={{ color }}>
          {advice.headline}
        </span>
        <span className="cap mt-1 block leading-[1.6] text-text-secondary">{advice.detail}</span>
        {open && (
          <span className="cap mt-2 block border-t border-divider-subtle pt-2 leading-[1.6] text-text-secondary">
            {advice.basis}
          </span>
        )}
      </span>
      <span className="cap mt-px shrink-0 text-text-secondary" aria-hidden>
        {open ? "▲" : "▼"}
      </span>
    </button>
  );
}

/** The open-ring brand mark (same glyph as the wordmark in Logo), inherits color. */
function BrandMark({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10.5445 18.2821V21.325C9.74773 21.3967 8.97425 21.2854 8.21156 21.1183C3.82855 20.1565 0.81839 16.9758 0.152124 12.5104C-0.34802 9.15969 0.362596 6.09428 2.61834 3.48687C4.27683 1.56885 6.41913 0.50951 8.90926 0.131368C9.35685 0.0631111 9.81196 0.0460469 10.2643 0.00993912C10.3409 0.00447858 10.4195 0.0249556 10.5425 0.0378561V2.99617C9.77916 3.15446 9.0268 3.23917 8.32158 3.46851C5.54171 4.37428 3.90782 6.3155 3.38437 9.17068C3.02903 11.1085 3.2764 12.9889 4.28981 14.6953C5.48089 16.7014 7.27742 17.8467 9.60218 18.1484C9.91515 18.1886 10.2261 18.2371 10.5445 18.2821Z"
        fill="currentColor"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M20.8232 15.9878C18.7465 19.8886 14.6368 21.4545 11.5569 21.3514V18.3065C12.0742 18.2273 12.6181 18.1829 13.1429 18.0573C15.9815 17.3775 17.8129 15.6213 18.5578 12.807C19.2261 10.2836 18.8414 7.90761 17.2307 5.81821C16.0861 4.33362 14.5089 3.52 12.6646 3.22029C12.3058 3.16165 11.9457 3.11319 11.5862 3.05927C11.5774 3.05783 11.5698 3.0463 11.5446 3.02582V0C14.7399 0.0587008 17.4412 1.18494 19.5644 3.59713C22.3648 6.77721 22.9292 12.0323 20.8232 15.9878Z"
        fill="currentColor"
      />
    </svg>
  );
}
