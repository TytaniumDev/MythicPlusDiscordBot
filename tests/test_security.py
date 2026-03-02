import os
import sys
import unittest
from unittest.mock import patch

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.security import obfuscate_pii, sanitize_for_github, sanitize_logs


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


class TestObfuscatePii(unittest.TestCase):
    def test_discord_object_repr(self):
        text = "<Member id=123456789012345678 name='JohnDoe' discriminator='1234'>"
        result = obfuscate_pii(text)
        self.assertNotIn("123456789012345678", result)
        self.assertNotIn("JohnDoe", result)
        self.assertIn("[REDACTED_ID]", result)
        self.assertIn("[REDACTED]", result)

    def test_voice_channel_repr(self):
        text = "<VoiceChannel id=987654321098765432 name='Gaming Lounge'>"
        result = obfuscate_pii(text)
        self.assertNotIn("987654321098765432", result)
        self.assertNotIn("Gaming Lounge", result)

    def test_user_context_line(self):
        text = "User: JohnDoe (123456789012345678)"
        result = obfuscate_pii(text)
        self.assertNotIn("JohnDoe", result)
        self.assertNotIn("123456789012345678", result)
        self.assertIn("[REDACTED_USER]", result)
        self.assertIn("[REDACTED_ID]", result)

    def test_channel_context_line(self):
        text = "Channel: #my-secret-channel"
        result = obfuscate_pii(text)
        self.assertNotIn("my-secret-channel", result)
        self.assertIn("[REDACTED_CHANNEL]", result)

    def test_bare_snowflake_ids(self):
        text = "Error for guild 123456789012345678 in channel 987654321098765432"
        result = obfuscate_pii(text)
        self.assertNotIn("123456789012345678", result)
        self.assertNotIn("987654321098765432", result)
        self.assertEqual(result.count("[REDACTED_ID]"), 2)

    def test_preserves_short_numbers(self):
        text = "Error code 12345 at line 67"
        self.assertEqual(obfuscate_pii(text), text)

    def test_username_discriminator(self):
        text = "Something about CoolUser#9876 happened"
        result = obfuscate_pii(text)
        self.assertNotIn("CoolUser#9876", result)
        self.assertIn("[REDACTED_USER]", result)

    def test_empty_string(self):
        self.assertEqual(obfuscate_pii(""), "")

    def test_no_pii(self):
        text = "Just a normal error message with no PII"
        self.assertEqual(obfuscate_pii(text), text)

    def test_preserves_code_paths(self):
        text = 'File "/app/cogs/groups.py", line 45, in wheel'
        self.assertEqual(obfuscate_pii(text), text)

    def test_full_context_string(self):
        text = (
            "App Command: /wheel\n"
            "User: Tytanium (202184987469021184)\n"
            "Channel: <VoiceChannel id=123456789012345678 name='Gaming'>"
        )
        result = obfuscate_pii(text)
        self.assertNotIn("Tytanium", result)
        self.assertNotIn("202184987469021184", result)
        self.assertNotIn("Gaming", result)
        self.assertIn("/wheel", result)


class TestSanitizeForGithub(unittest.TestCase):
    def test_chains_both_sanitizers(self):
        with patch("core.config.BOT_TOKEN", "SECRET_TOKEN"):
            text = "Token SECRET_TOKEN\nUser: JohnDoe (123456789012345678)"
            result = sanitize_for_github(text)
            self.assertNotIn("SECRET_TOKEN", result)
            self.assertNotIn("JohnDoe", result)
            self.assertNotIn("123456789012345678", result)

    def test_handles_empty_string(self):
        self.assertEqual(sanitize_for_github(""), "")
