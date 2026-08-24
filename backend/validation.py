"""
Input validation for uploaded audio files.
"""

ALLOWED_EXTENSIONS = {"mp3", "wav", "m4a"}
MAX_FILE_SIZE_MB = 25
MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024


class ValidationError(Exception):
    """Raised when file validation fails."""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


def validate_audio_file(filename: str, file_size: int) -> None:
    """
    Validate an uploaded audio file by extension and size.

    Raises ValidationError with a human-readable message if invalid.
    """
    if not filename:
        raise ValidationError("No filename provided.")

    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if extension not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise ValidationError(
            f"Unsupported file type '.{extension}'. Accepted formats: {allowed}."
        )

    if file_size > MAX_FILE_SIZE_BYTES:
        raise ValidationError(
            f"File too large ({file_size / (1024 * 1024):.1f} MB). "
            f"Maximum allowed size is {MAX_FILE_SIZE_MB} MB."
        )

    if file_size == 0:
        raise ValidationError("File is empty (0 bytes).")
