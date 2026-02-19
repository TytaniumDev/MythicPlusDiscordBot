import os
import sys
import unittest
from unittest.mock import patch

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.security import sanitize_logs


class TestSecurity(unittest.TestCase):
    def test_sanitize_logs(self):
        with (
            patch("core.config.BOT_TOKEN", "SECRET_TOKEN"),
            patch("core.config.FIREBASE_CREDENTIALS_JSON", '{"private_key": "abc"}'),
            patch("core.config.GITHUB_TOKEN", "ghp_secret"),
        ):
            logs = 'Error: Invalid token SECRET_TOKEN provided. also gh: ghp_secret and fb: {"private_key": "abc"}'
            sanitized = sanitize_logs(logs)

            self.assertIsNotNone(sanitized)
            # Type narrowing assertion for pyright
            assert sanitized is not None

            self.assertNotIn("SECRET_TOKEN", sanitized)
            self.assertIn("[REDACTED_BOT_TOKEN]", sanitized)

            self.assertNotIn("ghp_secret", sanitized)
            self.assertIn("[REDACTED_GITHUB_TOKEN]", sanitized)

            self.assertNotIn('{"private_key": "abc"}', sanitized)
            self.assertIn("[REDACTED_FIREBASE_CREDENTIALS]", sanitized)

    def test_sanitize_logs_no_secrets(self):
        logs = "Just some normal logs."
        self.assertEqual(sanitize_logs(logs), logs)

    def test_sanitize_logs_none(self):
        self.assertIsNone(sanitize_logs(None))

    def test_sanitize_logs_empty(self):
        self.assertEqual(sanitize_logs(""), "")
