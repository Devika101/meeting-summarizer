"""
Automated unit tests for validation, schema parsing, and edge cases.
Run with: pytest tests/
"""

import os
import pytest
from backend.validation import validate_audio_file, ValidationError
from backend.summarization import _validate_result, summarize_transcript


def test_validation_allowed_extensions():
    # Valid extensions should pass without exception
    validate_audio_file("meeting.mp3", 1024)
    validate_audio_file("recording.wav", 1024)
    validate_audio_file("audio.m4a", 1024)


def test_validation_disallowed_extension():
    with pytest.raises(ValidationError) as excinfo:
        validate_audio_file("document.pdf", 1024)
    assert "Unsupported file type '.pdf'" in str(excinfo.value.message)
    assert excinfo.value.status_code == 400


def test_validation_oversized_file():
    max_bytes = 25 * 1024 * 1024
    with pytest.raises(ValidationError) as excinfo:
        validate_audio_file("huge.mp3", max_bytes + 1)
    assert "File too large" in str(excinfo.value.message)
    assert excinfo.value.status_code == 400


def test_validation_empty_file():
    with pytest.raises(ValidationError) as excinfo:
        validate_audio_file("empty.mp3", 0)
    assert "File is empty" in str(excinfo.value.message)
    assert excinfo.value.status_code == 400


def test_schema_validation_valid():
    sample_data = {
        "summary": "This is a summary of the meeting.",
        "decisions": ["Decision 1", "Decision 2"],
        "action_items": [
            {
                "task": "Write documentation",
                "owner": "Alice",
                "deadline": "Friday",
                "priority": "high"
            }
        ]
    }
    validated = _validate_result(sample_data)
    assert validated["summary"] == sample_data["summary"]
    assert len(validated["action_items"]) == 1
    assert validated["action_items"][0]["owner"] == "Alice"


def test_schema_validation_defaults_and_normalization():
    sample_data = {
        "summary": "Short summary.",
        "decisions": [],
        "action_items": [
            {
                "task": "Fix bug",
                # missing owner, deadline, invalid priority
                "priority": "urgent_invalid"
            }
        ]
    }
    validated = _validate_result(sample_data)
    item = validated["action_items"][0]
    assert item["owner"] == "Unassigned"
    assert item["deadline"] is None
    assert item["priority"] == "medium"  # defaulted from invalid priority


def test_schema_validation_missing_keys():
    with pytest.raises(ValueError) as excinfo:
        _validate_result({"summary": "missing decisions and action items"})
    assert "Missing required keys" in str(excinfo.value)
