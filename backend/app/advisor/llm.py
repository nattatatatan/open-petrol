"""Claude language layer — the ONLY place the Anthropic key is used (CLAUDE.md §6).

Hard boundary: Claude phrases and parses; it never produces a number the user acts
on. We hand it the deterministic facts via a tool, let it answer the free-text
question, and then keep the verdict + every number from the deterministic layer —
Claude's output is used only as prose. Hardened per §11: tiny max_tokens, one tool
round, temperature 0, scope-limiting system prompt, question length-capped.
"""

from __future__ import annotations

import json

from anthropic import AsyncAnthropic

from app.advisor.service import AdvisorResult  # type: ignore[attr-defined]
from app.config import Settings
from app.engine.cycle import CycleAssessment

MAX_QUESTION_CHARS = 280

SYSTEM_PROMPT = (
    "You are a fuel-savings assistant for NSW drivers. You will receive VERIFIED facts "
    "from the get_fuel_facts tool. Rules you must follow:\n"
    "1. Use ONLY values returned by the tool. NEVER invent, estimate, or recall a price, "
    "saving, distance, date, or verdict.\n"
    "2. If the facts don't contain what's needed to answer, say you don't have that data.\n"
    "3. Reply in at most two short, plain sentences. No markdown, no preamble.\n"
    "4. Be honest about uncertainty when confidence is low."
)

TOOLS = [
    {
        "name": "get_fuel_facts",
        "description": "Verified fuel price-cycle facts and the current recommendation. "
        "All numbers you may use come from here.",
        "input_schema": {"type": "object", "properties": {}},
    }
]


def _facts(cycle: CycleAssessment, deterministic: "AdvisorResult", fuel: str, tank: float) -> dict:
    return {
        "fuel": fuel,
        "tank_litres": tank,
        "verdict": deterministic.verdict,
        "phase": cycle.phase,
        "position_in_range_0_to_1": cycle.position_in_range,
        "trend_cents_per_day": cycle.trend_cents_per_day,
        "wait_days": deterministic.wait_days,
        "expected_saving_per_tank_aud": deterministic.expected_saving_per_tank,
        "recent_low_cents": cycle.recent_low,
        "recent_high_cents": cycle.recent_high,
        "today_low_cents": cycle.current_low,
        "confidence": deterministic.confidence,
        "recommended_station": deterministic.recommended_station,
    }


async def phrase_with_claude(
    *,
    settings: Settings,
    question: str,
    cycle: CycleAssessment,
    deterministic: "AdvisorResult",
    fuel: str,
    tank: float,
) -> "AdvisorResult":
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    facts = _facts(cycle, deterministic, fuel, tank)
    question = question[:MAX_QUESTION_CHARS]

    first = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=200,
        temperature=0,
        system=SYSTEM_PROMPT,
        tools=TOOLS,
        messages=[{"role": "user", "content": question}],
    )

    # Single tool round: feed the verified facts back, get the phrased answer.
    text = _extract_text(first)
    tool_use = next((b for b in first.content if b.type == "tool_use"), None)
    if tool_use is not None:
        followup = await client.messages.create(
            model=settings.anthropic_model,
            max_tokens=200,
            temperature=0,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=[
                {"role": "user", "content": question},
                {"role": "assistant", "content": first.content},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use.id,
                            "content": json.dumps(facts),
                        }
                    ],
                },
            ],
        )
        text = _extract_text(followup)

    # Keep ALL structured fields from the deterministic layer; only the prose is Claude's.
    return deterministic.model_copy(
        update={"detail": text.strip() or deterministic.detail, "source": "llm"}
    )


def _extract_text(message) -> str:
    return "".join(b.text for b in message.content if b.type == "text")
