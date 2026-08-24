"""
LLM summarization module.

Sends a meeting transcript to GPT-4o with JSON mode enabled,
validates the response against the expected schema, and retries
once on malformed output.
"""

import json
import os
from openai import OpenAI

SYSTEM_PROMPT = """You are a precise meeting analyst. Your job is to read a meeting transcript and extract structured information. You MUST respond with valid JSON matching the exact schema below — no markdown, no commentary, no extra keys.

JSON Schema:
{
  "summary": "string — a concise summary of the meeting in 3-6 sentences",
  "decisions": ["string — each key decision made during the meeting"],
  "action_items": [
    {
      "task": "string — description of the action item",
      "owner": "string — person responsible, or 'Unassigned' if not mentioned",
      "deadline": "string | null — deadline if mentioned, else null",
      "priority": "string — 'high', 'medium', or 'low', inferred from urgency language"
    }
  ]
}

Rules:
- "summary" should capture the main topics discussed, conclusions reached, and overall meeting purpose.
- "decisions" should list only concrete decisions, not discussion points. If no decisions were made, return an empty array.
- "action_items" should list every task, to-do, or follow-up mentioned or implied. Infer priority from language: words like "urgent", "ASAP", "critical", "blocker" → high; "should", "next sprint", "when you get a chance" → low; everything else → medium.
- If the transcript is very short or contains no actionable content, still return the full JSON structure with empty arrays and a brief summary.
- Do NOT fabricate information not present in the transcript."""

USER_PROMPT_TEMPLATE = """Here is the meeting transcript:

---
{transcript}
---

Analyze this transcript and return the structured JSON as specified."""

EXPECTED_KEYS = {"summary", "decisions", "action_items"}
ACTION_ITEM_KEYS = {"task", "owner", "deadline", "priority"}
VALID_PRIORITIES = {"high", "medium", "low"}


def _validate_result(data: dict) -> dict:
    """
    Validate and normalize the parsed JSON against the expected schema.
    Raises ValueError if the structure is fundamentally wrong.
    """
    missing = EXPECTED_KEYS - set(data.keys())
    if missing:
        raise ValueError(f"Missing required keys: {missing}")

    if not isinstance(data["summary"], str):
        raise ValueError("'summary' must be a string")

    if not isinstance(data["decisions"], list):
        raise ValueError("'decisions' must be a list")

    if not isinstance(data["action_items"], list):
        raise ValueError("'action_items' must be a list")

    normalized_items = []
    for item in data["action_items"]:
        if not isinstance(item, dict):
            raise ValueError("Each action item must be an object")

        normalized = {
            "task": str(item.get("task", "")),
            "owner": str(item.get("owner", "Unassigned")) or "Unassigned",
            "deadline": item.get("deadline"),
            "priority": item.get("priority", "medium"),
        }

        if normalized["priority"] not in VALID_PRIORITIES:
            normalized["priority"] = "medium"

        if normalized["deadline"] is not None:
            normalized["deadline"] = str(normalized["deadline"])

        normalized_items.append(normalized)

    data["action_items"] = normalized_items
    return data


def _call_llm(transcript: str) -> str:
    """Make the GPT-4o API call and return raw content."""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "sk-your-openai-api-key-here":
        raise ValueError("Missing or unconfigured OPENAI_API_KEY. Please set your API key in .env.")

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": USER_PROMPT_TEMPLATE.format(transcript=transcript)},
        ],
        temperature=0.2,
    )
    return response.choices[0].message.content


def summarize_transcript(transcript: str) -> dict:
    """
    Summarize a meeting transcript into structured JSON.

    Returns:
        {
            "summary": "...",
            "decisions": ["..."],
            "action_items": [{"task", "owner", "deadline", "priority"}, ...],
            "parse_error": False
        }

    On malformed JSON after retry:
        {
            "summary": "<raw LLM output>",
            "decisions": [],
            "action_items": [],
            "parse_error": True
        }
    """
    last_error = None

    for attempt in range(2):
        try:
            raw = _call_llm(transcript)
            data = json.loads(raw)
            validated = _validate_result(data)
            validated["parse_error"] = False
            return validated
        except (json.JSONDecodeError, ValueError) as e:
            last_error = e
            continue

    # Both attempts failed — return raw output as fallback
    return {
        "summary": f"(Could not parse structured output — raw response below)\n\n{raw}",
        "decisions": [],
        "action_items": [],
        "parse_error": True,
    }
