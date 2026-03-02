import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, mock_open, patch

import discord
from discord import app_commands
from discord.ext import commands

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bot import MythicPlusBot


class TestErrorHandling(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.bot = MythicPlusBot()
        self.mock_dev = AsyncMock(spec=discord.User)
        self.mock_dev.send = AsyncMock()

    @patch("bot.create_error_issue", new_callable=AsyncMock, return_value=None)
    @patch("bot.MythicPlusBot.fetch_user")
    @patch("bot.MythicPlusBot.get_user")
    async def test_send_error_to_dev_short_with_log(
        self,
        mock_get_user: MagicMock,
        mock_fetch_user: MagicMock,
        mock_create_issue: AsyncMock,
    ):
        mock_get_user.return_value = self.mock_dev

        error = ValueError("Test Error")

        # Mock os.path.exists to simulate log file existence and open to avoid FileNotFoundError
        with (
            patch("os.path.exists", return_value=True),
            patch("builtins.open", mock_open(read_data="mock log data")),
        ):
            await self.bot._send_error_to_dev(error, "Test Context")  # pyright: ignore[reportPrivateUsage]

        self.mock_dev.send.assert_called_once()
        args, kwargs = self.mock_dev.send.call_args
        message = args[0]
        self.assertIn("Bot Error Detected", message)
        self.assertIn("Test Context", message)
        self.assertIn("Test Error", message)
        self.assertIn("ValueError", message)

        # Verify files list
        self.assertIn("files", kwargs)
        self.assertEqual(len(kwargs["files"]), 1)
        self.assertIsInstance(kwargs["files"][0], discord.File)

    @patch("bot.create_error_issue", new_callable=AsyncMock, return_value=None)
    @patch("bot.MythicPlusBot.fetch_user")
    @patch("bot.MythicPlusBot.get_user")
    async def test_send_error_to_dev_long_with_log(
        self,
        mock_get_user: MagicMock,
        mock_fetch_user: MagicMock,
        mock_create_issue: AsyncMock,
    ):
        mock_get_user.return_value = self.mock_dev

        try:
            raise ValueError("Long Error")
        except Exception as e:
            error = e

        # Mock traceback.format_exception to return a very long list
        with (
            patch("traceback.format_exception") as mock_format,
            patch("os.path.exists", return_value=True),
            patch("builtins.open", mock_open(read_data="mock log data")),
        ):
            mock_format.return_value = ["A" * 2000]
            await self.bot._send_error_to_dev(error, "Test Context")  # pyright: ignore[reportPrivateUsage]

        self.mock_dev.send.assert_called_once()
        _, kwargs = self.mock_dev.send.call_args

        self.assertIn("files", kwargs)
        self.assertEqual(len(kwargs["files"]), 2)  # traceback + log

        # Check that one file is traceback and other is log (order might vary)
        filenames = [f.filename for f in kwargs["files"]]
        self.assertIn("traceback.txt", filenames)

    @patch("bot.MythicPlusBot._send_error_to_dev")
    async def test_on_command_error_calls_send_to_dev(
        self, mock_send_to_dev: MagicMock
    ):
        ctx = MagicMock(spec=commands.Context)
        ctx.command = "test_cmd"
        ctx.author = MagicMock()
        ctx.author.id = 12345
        ctx.channel = "test_channel"
        ctx.send = AsyncMock()

        error = commands.CommandError("Unexpected Error")

        await self.bot.on_command_error(ctx, error)

        mock_send_to_dev.assert_called_once()
        args, _ = mock_send_to_dev.call_args
        self.assertEqual(args[0], error)
        self.assertIn("Command: !test_cmd", args[1])

    @patch("bot.MythicPlusBot._send_error_to_dev")
    async def test_on_app_command_error_calls_send_to_dev(
        self, mock_send_to_dev: MagicMock
    ):
        interaction = MagicMock(spec=discord.Interaction)
        interaction.command = MagicMock()
        interaction.command.name = "test_slash"
        interaction.user = MagicMock()
        interaction.user.id = 12345
        interaction.channel = MagicMock()

        interaction.response = MagicMock(spec=discord.InteractionResponse)
        interaction.response.is_done.return_value = True
        interaction.response.send_message = AsyncMock()

        interaction.followup = MagicMock(spec=discord.Webhook)
        interaction.followup.send = AsyncMock()

        error = app_commands.AppCommandError("Unexpected Slash Error")

        await self.bot.on_app_command_error(interaction, error)

        mock_send_to_dev.assert_called_once()
        args, _ = mock_send_to_dev.call_args
        self.assertEqual(args[0], error)
        self.assertIn("App Command: /test_slash", args[1])
        interaction.followup.send.assert_called_once()

    @patch("bot.MythicPlusBot._send_error_to_dev")
    async def test_on_error_calls_send_to_dev(self, mock_send_to_dev: MagicMock):
        error = ValueError("Event Error")
        with patch(
            "sys.exc_info", return_value=(type(error), error, error.__traceback__)
        ):
            await self.bot.on_error("on_message", "arg1")

        mock_send_to_dev.assert_called_once()
        args, _ = mock_send_to_dev.call_args
        self.assertEqual(args[0], error)
        self.assertIn("Event: on_message", args[1])

    @patch("bot.create_error_issue", new_callable=AsyncMock)
    @patch("bot.MythicPlusBot.fetch_user")
    @patch("bot.MythicPlusBot.get_user")
    async def test_send_error_to_dev_creates_github_issue(
        self,
        mock_get_user: MagicMock,
        mock_fetch_user: MagicMock,
        mock_create_issue: AsyncMock,
    ):
        mock_get_user.return_value = self.mock_dev
        mock_create_issue.return_value = {"html_url": "http://github.com/issue/1"}

        error = ValueError("Test Error")

        with (
            patch("os.path.exists", return_value=True),
            patch("builtins.open", mock_open(read_data="mock log data")),
        ):
            await self.bot._send_error_to_dev(error, "Test Context")  # pyright: ignore[reportPrivateUsage]

        mock_create_issue.assert_called_once_with(error, "Test Context")

        # Verify issue URL was sent as follow-up DM
        calls = self.mock_dev.send.call_args_list
        self.assertEqual(len(calls), 2)
        self.assertIn("http://github.com/issue/1", calls[1].args[0])

    @patch("bot.create_error_issue", new_callable=AsyncMock, return_value=None)
    @patch("bot.MythicPlusBot.fetch_user")
    @patch("bot.MythicPlusBot.get_user")
    async def test_send_error_to_dev_no_followup_when_no_issue(
        self,
        mock_get_user: MagicMock,
        mock_fetch_user: MagicMock,
        mock_create_issue: AsyncMock,
    ):
        mock_get_user.return_value = self.mock_dev

        error = ValueError("Test Error")

        with (
            patch("os.path.exists", return_value=True),
            patch("builtins.open", mock_open(read_data="mock log data")),
        ):
            await self.bot._send_error_to_dev(error, "Test Context")  # pyright: ignore[reportPrivateUsage]

        # Only the error DM, no follow-up for issue URL
        self.mock_dev.send.assert_called_once()

    @patch("bot.create_error_issue", new_callable=AsyncMock)
    @patch("bot.MythicPlusBot.fetch_user")
    @patch("bot.MythicPlusBot.get_user")
    async def test_github_issue_created_even_when_dm_fails(
        self,
        mock_get_user: MagicMock,
        mock_fetch_user: MagicMock,
        mock_create_issue: AsyncMock,
    ):
        mock_get_user.return_value = None  # Can't find developer
        mock_create_issue.return_value = None

        error = ValueError("Test Error")

        await self.bot._send_error_to_dev(error, "Test Context")  # pyright: ignore[reportPrivateUsage]

        # Issue creation should still be attempted
        mock_create_issue.assert_called_once_with(error, "Test Context")


if __name__ == "__main__":
    unittest.main()
