"""
Meeting Summarizer — FastAPI application.

Routes:
    POST /api/process  — Upload audio, transcribe, summarize (SSE stream)
    GET  /api/health    — Health check
    GET  /               — Serves frontend
"""

import asyncio
import json
import os
import tempfile
import traceback

from dotenv import load_dotenv
from pydantic import BaseModel
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles

load_dotenv()

from backend.transcription import transcribe_audio
from backend.summarization import summarize_transcript
from backend.validation import validate_audio_file, ValidationError

app = FastAPI(title="Meeting Summarizer", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    return {"status": "ok"}


async def _sse_event(event: str, data: dict) -> str:
    """Format a Server-Sent Event message."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/api/process")
async def process_audio(file: UploadFile = File(...)):
    """
    Accept an audio file, transcribe it via Whisper, summarize via GPT-4o,
    and stream progress updates via SSE.
    """

    # Validate before reading the full file
    content = await file.read()
    file_size = len(content)

    try:
        validate_audio_file(file.filename, file_size)
    except ValidationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    async def event_stream():
        tmp_path = None
        try:
            # Stage 1: Saving uploaded file
            yield await _sse_event("progress", {"stage": "uploading", "message": "Receiving audio..."})

            suffix = os.path.splitext(file.filename)[1]
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            # Stage 2: Transcribing
            yield await _sse_event("progress", {"stage": "transcribing", "message": "Listening..."})
            await asyncio.sleep(0)  # Yield control so SSE flushes

            transcript_result = await asyncio.to_thread(transcribe_audio, tmp_path)

            # Stage 3: Summarizing
            yield await _sse_event("progress", {"stage": "summarizing", "message": "Finding the decisions..."})
            await asyncio.sleep(0)

            summary_result = await asyncio.to_thread(
                summarize_transcript, transcript_result["text"]
            )

            # Stage 4: Done
            yield await _sse_event("progress", {"stage": "finalizing", "message": "Writing the tasks..."})
            await asyncio.sleep(0.3)  # Brief pause so user sees the final stage

            result = {
                "transcript": transcript_result,
                "summary": summary_result["summary"],
                "decisions": summary_result["decisions"],
                "action_items": summary_result["action_items"],
                "parse_error": summary_result.get("parse_error", False),
            }

            yield await _sse_event("complete", result)

        except Exception as e:
            error_msg = str(e)
            err_lower = error_msg.lower()
            if any(k in err_lower for k in ["invalid_api_key", "authentication", "401", "user not found", "unauthorized", "api key", "gemini_api_key", "api_key_invalid", "permission_denied"]):
                error_msg = "Invalid or missing Gemini API key. Please set a valid GEMINI_API_KEY in your .env file."
            elif any(k in err_lower for k in ["could not process", "audio", "corrupt", "unsupported"]):
                error_msg = f"Could not process this audio file. It may be corrupted or in an unsupported format. ({error_msg})"

            yield await _sse_event("error", {"message": error_msg})
            traceback.print_exc()
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# Serve frontend static files
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")

class ChatRequest(BaseModel):
    message: str
    context: str

@app.post("/api/chat")
async def chat_with_bot(req: ChatRequest):
    """Chat endpoint to query the meeting summary."""
    try:
        from openai import OpenAI
        # Using the same OpenAI-compatible Gemini endpoint as summarization
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key or api_key == "your-gemini-api-key-here":
            raise HTTPException(status_code=401, detail="API Key not configured")
        
        client = OpenAI(api_key=api_key, base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
        response = client.chat.completions.create(
            model="gemini-3.6-flash",
            messages=[
                {"role": "system", "content": "You are a helpful assistant embedded in a meeting summarizer app. Your job is to answer questions strictly based on the provided meeting context. Be concise and conversational."},
                {"role": "user", "content": f"MEETING CONTEXT:\n{req.context}\n\nUSER QUESTION:\n{req.message}"},
            ],
            temperature=0.3,
        )
        return {"response": response.choices[0].message.content}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def serve_index():
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"))

app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")
