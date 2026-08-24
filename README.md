# Meeting Summarizer

**Turn the room into the record.** Upload a meeting recording, get a structured summary, key decisions, and action items — in seconds.

![Python](https://img.shields.io/badge/Python-3.11+-blue) ![FastAPI](https://img.shields.io/badge/FastAPI-0.115-green) ![OpenAI](https://img.shields.io/badge/OpenAI-Whisper%20%2B%20GPT--4o-orange)

---

## What It Does

1. **Upload** an audio file (MP3, WAV, M4A — up to 25 MB)
2. **Transcribe** the audio using OpenAI Whisper API, with per-segment timestamps
3. **Summarize** the transcript using GPT-4o, producing:
   - A concise meeting summary (3–6 sentences)
   - Key decisions (bullet list)
   - Structured action items (task, owner, deadline, priority)
4. **Export** results as a Slack-formatted message (copy) or Markdown file (download)

Progress is streamed in real-time via SSE, visualized as an animated VU-meter — no dead loading time.

---

## Architecture Overview

```
Frontend (static HTML/CSS/JS)
    │
    │  POST /api/process (multipart upload)
    │  ← SSE stream (progress + result)
    │
FastAPI Backend
    ├── validation.py   → file type/size checks
    ├── transcription.py → OpenAI Whisper API (verbose_json)
    └── summarization.py → GPT-4o (JSON mode + schema validation)
```

A single-page app with no build step. The FastAPI backend serves the frontend as static files and exposes one API endpoint that streams progress via Server-Sent Events. No database — everything is processed in memory and returned immediately.

---

## Run Locally

### Prerequisites
- Python 3.11+
- An OpenAI API key with access to Whisper and GPT-4o

### Setup

```bash
# Clone the repo
git clone <repo-url> && cd meeting-summarizer

# Create a virtual environment
python -m venv venv
source venv/bin/activate      # Linux/Mac
# venv\Scripts\activate       # Windows

# Install dependencies
pip install -r backend/requirements.txt

# Configure API keys
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Run the app
uvicorn backend.main:app --reload --port 8000
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

---

## Design Decisions & Trade-offs

| Decision | Rationale |
|----------|-----------|
| **Whisper API over self-hosted** | Reliability and speed — no GPU setup, no model download. Trades cost per request for zero infrastructure overhead. Appropriate for a 2-day scoped demo. |
| **GPT-4o with JSON mode** | More reliable structured output than freeform parsing. The prompt includes an explicit schema, and the backend validates/normalizes the response with a retry on malformed JSON. |
| **Vanilla HTML/CSS/JS instead of React** | This is a single-page, single-flow app. A framework adds build tooling, a package.json, and bundle complexity with zero UX benefit here. |
| **SSE instead of WebSocket** | One-directional progress updates don't need bidirectional communication. SSE is simpler, works through proxies, and auto-reconnects. |
| **No database** | Files are processed in memory and cleaned up immediately. Results are returned inline. Persistence is explicitly out of scope. |
| **No speaker diarization** | Whisper API doesn't natively support it; third-party diarization would add significant complexity and latency for marginal benefit in a time-boxed project. |
| **Studio/console visual design** | Deliberately opinionated — 200 submissions will use default Tailwind cards. This design (VU meters, amber accents, equipment-label typography) is visually distinct and tied to the subject matter. |

---

## Prompts

The exact prompts used for summarization are documented in [`prompts/summarization_prompt.md`](prompts/summarization_prompt.md), including design rationale for each prompt engineering choice.

---

## Known Limitations

- **File size**: 25 MB max (Whisper API limit). Long meetings may need pre-trimming.
- **No chunking**: Files exceeding Whisper's native context window will fail — no automatic splitting.
- **No diarization**: The transcript is a single stream; no speaker labels.
- **Single language**: English only (Whisper can auto-detect, but the summarization prompt is English-only).
- **No persistence**: Refreshing the page loses results. The download/copy export is the only way to save.
- **Timestamps are decorative**: Hovering timestamps visually promises "jump to point" but doesn't actually play the audio at that position.

---

## What I'd Improve With More Time

1. **Audio playback with seek** — embed the uploaded file in an `<audio>` element and wire timestamp clicks to `currentTime`.
2. **Long-audio chunking** — split files > 25 MB into overlapping chunks, transcribe in parallel, merge.
3. **Speaker diarization** — integrate a diarization model (e.g., pyannote) to label speakers.
4. **Persistent history** — SQLite or IndexedDB to store past summaries and recall them.
5. **Prompt tuning** — A/B test different prompt structures, especially for priority inference accuracy.
6. **Streaming summarization** — stream the LLM response token-by-token to reduce perceived wait time.
7. **End-to-end tests** — Playwright test suite covering upload, processing, and export flows.

---

## Project Structure

```
├── backend/
│   ├── __init__.py
│   ├── main.py              # FastAPI app, routes, SSE streaming
│   ├── transcription.py     # Whisper API call
│   ├── summarization.py     # GPT-4o + JSON validation
│   └── validation.py        # File type/size checks
├── frontend/
│   ├── index.html            # Single-page UI
│   ├── styles.css            # Studio console design system
│   └── app.js                # Upload, progress, rendering, export
├── prompts/
│   └── summarization_prompt.md
├── .env.example
├── .gitignore
├── render.yaml               # Render deployment config
├── EVALUATION.md
└── README.md
```

---

## Deployment

Configured for [Render](https://render.com):

1. Push to a Git repo
2. Create a new **Web Service** on Render
3. Connect the repo, set `OPENAI_API_KEY` as an environment variable
4. Render auto-detects the `render.yaml` config

Alternatively, run with Docker or any Python hosting that supports `uvicorn`.

---

## License

MIT
