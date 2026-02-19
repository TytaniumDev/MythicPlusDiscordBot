from core import config


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
