"""
Audio transcription module using Google Gemini.

Uses Gemini's multimodal capabilities to transcribe audio files
and return timestamped segments.
"""

import json
import os
from google import genai


def transcribe_audio(file_path: str) -> dict:
    """
    Transcribe an audio file using Google Gemini API.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your-gemini-api-key-here":
        raise ValueError("Missing or unconfigured GEMINI_API_KEY. Please set your API key in .env.")

    client = genai.Client(api_key=api_key)

    # Upload the audio file to Gemini
    uploaded_file = client.files.upload(file=file_path)

    # Use Gemini to transcribe with timestamps
    response = client.models.generate_content(
        model="gemini-3.6-flash",
        contents=[
            uploaded_file,
            """Transcribe this audio file completely and accurately.

Return your response as valid JSON with this exact structure:
{
  "text": "the complete transcription as a single string",
  "segments": [
    {"start": 0.0, "end": 5.2, "text": "segment text here"},
    {"start": 5.2, "end": 10.1, "text": "next segment text"}
  ]
}

Rules:
- "text" must contain the FULL transcription.
- "segments" should break the transcript into logical segments (by sentence or speaker turn).
- Start/end times should be approximate timestamps in seconds.
- Return ONLY the JSON object, no markdown, no commentary."""
        ],
    )

    # Parse the response
    raw_text = response.text.strip()

    # Remove markdown code fences if present
    if raw_text.startswith("```"):
        lines = raw_text.split("\n")
        # Remove first and last lines (```json and ```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        raw_text = "\n".join(lines)

    try:
        result = json.loads(raw_text)
        segments = []
        for seg in result.get("segments", []):
            segments.append({
                "start": round(float(seg.get("start", 0)), 2),
                "end": round(float(seg.get("end", 0)), 2),
                "text": str(seg.get("text", "")).strip(),
            })
        return {
            "text": result.get("text", raw_text),
            "segments": segments,
        }
    except (json.JSONDecodeError, KeyError, TypeError):
        # Fallback: return the raw text as a single segment
        return {
            "text": raw_text,
            "segments": [],
        }
