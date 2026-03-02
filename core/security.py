import re

from core import config


def obfuscate_pii(text: str) -> str:
    """
    Replaces Discord PII (user IDs, names, guild IDs, channel IDs) with
    redacted placeholders.  Apply specific patterns first, then a catch-all
    for bare snowflake IDs.
    """
    if not text:
        return text

    # 1. Discord object repr: <Member id=123… name='Foo' …>
    text = re.sub(
        r"<(\w+)\s+id=\d{15,21}\s+name='[^']*'",
        r"<\1 id=[REDACTED_ID] name='[REDACTED]'",
        text,
    )

    # 2. "User: Name (ID)" context lines
    text = re.sub(
        r"(User:\s*).+?\s*\(\d{15,21}\)",
        r"\1[REDACTED_USER] ([REDACTED_ID])",
        text,
    )

    # 3. Username#Discriminator (legacy format)
    text = re.sub(r"\S+#\d{4}", "[REDACTED_USER]", text)

    # 4. "Channel: …" context lines
    text = re.sub(r"(Channel:\s*).+", r"\1[REDACTED_CHANNEL]", text)

    # 5. Bare Discord snowflake IDs (catch-all, last)
    text = re.sub(r"\b\d{17,20}\b", "[REDACTED_ID]", text)

    return text


def sanitize_for_github(text: str) -> str:
    """Redact both secrets and PII for safe inclusion in GitHub issues."""
    result = sanitize_logs(text)
    if result is None:
        return ""
    return obfuscate_pii(result)


def sanitize_logs(logs: str | None) -> str | None:
    """
    Redacts sensitive information from logs.
    """
    if not logs:
        return logs

    # Redact Bot Token
    if config.BOT_TOKEN:
        logs = logs.replace(config.BOT_TOKEN, "[REDACTED_BOT_TOKEN]")

    # Redact Firebase Credentials
    if config.FIREBASE_CREDENTIALS_JSON:
        logs = logs.replace(
            config.FIREBASE_CREDENTIALS_JSON, "[REDACTED_FIREBASE_CREDENTIALS]"
        )

    # Redact GitHub Token
    if config.GITHUB_TOKEN:
        logs = logs.replace(config.GITHUB_TOKEN, "[REDACTED_GITHUB_TOKEN]")

    return logs
