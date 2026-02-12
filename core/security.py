"""
Security utilities for the MythicPlusBot.
This module handles data sanitization and secret redaction.
"""

import re

from core import config

# List of configuration keys that should be redacted from logs
SENSITIVE_KEYS = [
    "BOT_TOKEN",
    "GITHUB_TOKEN",
    "FIREBASE_CREDENTIALS_JSON",
]

# Regex patterns for common secrets (fallback if exact values aren't matched)
# Matches GitHub PATs (ghp_ followed by 36 alphanumeric characters)
GITHUB_PAT_PATTERN = re.compile(r"ghp_[a-zA-Z0-9]{36}")


def sanitize_logs(logs: str | None) -> str:
    """
    Sanitizes log content by masking sensitive information.
    Redacts values found in core.config and known secret patterns.

    Args:
        logs: The raw log string.

    Returns:
        The sanitized log string with secrets replaced by [REDACTED].
    """
    if not logs:
        return ""

    sanitized = logs

    # Redact known configuration values
    for key in SENSITIVE_KEYS:
        value = getattr(config, key, None)
        # We only mask if the value is a string and reasonably long (e.g. > 5 chars)
        # to avoid masking common words if a secret is accidentally short or empty.
        if value and isinstance(value, str) and len(value) > 5:
            sanitized = sanitized.replace(value, "[REDACTED]")

    # Redact patterns
    sanitized = GITHUB_PAT_PATTERN.sub("[REDACTED_GITHUB_TOKEN]", sanitized)

    return sanitized
