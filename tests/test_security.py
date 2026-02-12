import os
import sys
import unittest
from unittest.mock import patch

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.security import sanitize_logs


class TestSecurity(unittest.TestCase):
    def test_sanitize_logs_no_secrets(self):
        """Test that logs with no secrets are returned unchanged."""
        logs = "This is a normal log message.\nINFO: Something happened."
        self.assertEqual(sanitize_logs(logs), logs)

    def test_sanitize_logs_empty(self):
        """Test that empty logs return empty string."""
        self.assertEqual(sanitize_logs(""), "")
        self.assertEqual(sanitize_logs(None), "")

    def test_sanitize_logs_known_config_secrets(self):
        """Test that secrets in config are redacted."""
        with (
            patch("core.config.BOT_TOKEN", "SECRET_BOT_TOKEN"),
            patch("core.config.GITHUB_TOKEN", "SECRET_GITHUB_TOKEN"),
        ):
            logs = "Connecting with SECRET_BOT_TOKEN and SECRET_GITHUB_TOKEN."
            expected = "Connecting with [REDACTED] and [REDACTED]."
            self.assertEqual(sanitize_logs(logs), expected)

    def test_sanitize_logs_github_pat_regex(self):
        """Test that GitHub PATs are redacted via regex."""
        # ghp_ + 36 chars
        token = "ghp_123456789012345678901234567890123456"
        logs = f"User token is {token}."
        expected = "User token is [REDACTED_GITHUB_TOKEN]."
        self.assertEqual(sanitize_logs(logs), expected)

    def test_sanitize_logs_short_secrets_ignored(self):
        """Test that very short secrets in config are NOT redacted to avoid false positives."""
        with patch("core.config.BOT_TOKEN", "1234"):
            logs = "Count is 1234."
            self.assertEqual(sanitize_logs(logs), logs)


if __name__ == "__main__":
    unittest.main()
