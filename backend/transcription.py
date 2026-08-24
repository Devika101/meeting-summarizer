"""
Whisper API transcription module.

Calls OpenAI's whisper-1 model with verbose_json format to get
per-segment timestamps alongside the full transcript.
"""

import os
from openai import OpenAI

def transcribe_audio(file_path: str) -> dict:
    """
    Transcribe an audio file using OpenAI Whisper API.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "sk-your-openai-api-key-here":
        raise ValueError("Missing or unconfigured OPENAI_API_KEY. Please set your API key in .env.")

    client = OpenAI(api_key=api_key)
    with open(file_path, "rb") as audio_file:
        response = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="verbose_json",
            timestamp_granularities=["segment"],
        )

    segments = []
    for seg in getattr(response, "segments", []) or []:
        segments.append(
            {
                "start": round(seg.get("start", seg.start if hasattr(seg, "start") else 0), 2),
                "end": round(seg.get("end", seg.end if hasattr(seg, "end") else 0), 2),
                "text": seg.get("text", getattr(seg, "text", "")).strip(),
            }
        )

    return {
        "text": response.text,
        "segments": segments,
    }
