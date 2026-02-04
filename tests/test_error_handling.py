import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

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

    @patch("bot.MythicPlusBot.fetch_user")
    @patch("bot.MythicPlusBot.get_user")
    async def test_send_error_to_dev_short(self, mock_get_user, mock_fetch_user):
        mock_get_user.return_value = self.mock_dev

        error = ValueError("Test Error")
        await self.bot._send_error_to_dev(error, "Test Context")

        self.mock_dev.send.assert_called_once()
        args, _ = self.mock_dev.send.call_args
        message = args[0]
        self.assertIn("Bot Error Detected", message)
        self.assertIn("Test Context", message)
        self.assertIn("Test Error", message)
        self.assertIn("ValueError", message)

    @patch("bot.MythicPlusBot.fetch_user")
    @patch("bot.MythicPlusBot.get_user")
    async def test_send_error_to_dev_long(self, mock_get_user, mock_fetch_user):
        mock_get_user.return_value = self.mock_dev

        try:
            raise ValueError("Long Error")
        except Exception as e:
            error = e

        # Mock traceback.format_exception to return a very long list
        with patch("traceback.format_exception") as mock_format:
            mock_format.return_value = ["A" * 2000]
            await self.bot._send_error_to_dev(error, "Test Context")

        self.mock_dev.send.assert_called_once()
        _, kwargs = self.mock_dev.send.call_args
        self.assertIn("file", kwargs)
        self.assertIsInstance(kwargs["file"], discord.File)
        self.assertEqual(kwargs["file"].filename, "traceback.txt")

    @patch("bot.MythicPlusBot._send_error_to_dev")
    async def test_on_command_error_calls_send_to_dev(self, mock_send_to_dev):
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
    async def test_on_app_command_error_calls_send_to_dev(self, mock_send_to_dev):
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
    async def test_on_error_calls_send_to_dev(self, mock_send_to_dev):
        error = ValueError("Event Error")
        self.bot.loop = MagicMock()
        with patch(
            "sys.exc_info", return_value=(type(error), error, error.__traceback__)
        ):
            self.bot.on_error("on_message", "arg1")

        self.bot.loop.create_task.assert_called_once()
        args, _ = mock_send_to_dev.call_args
        self.assertEqual(args[0], error)
        self.assertIn("Event: on_message", args[1])


if __name__ == "__main__":
    unittest.main()
