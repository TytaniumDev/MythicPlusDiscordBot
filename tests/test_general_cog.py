import os
import sys
import unittest
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import discord

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cogs.general import General  # noqa: E402, I001


class TestGeneralCog(unittest.IsolatedAsyncioTestCase):
    async def test_status_command(self):
        # Arrange
        bot = MagicMock()
        bot.latency = 0.05  # 50ms

        # Patch time to have a consistent start time
        with patch("time.time") as mock_time:
            # First call is for __init__ (start_time)
            # Second call is for status command (current_time)
            # Let's say it started at 1000 and now it is 1060 (1 min uptime)
            mock_time.side_effect = [1000.0, 1060.0]

            cog = General(bot)

            ctx = AsyncMock()
            ctx.guild.id = 12345

            with patch("os.getloadavg", return_value=(0.5, 0.4, 0.3)):
                # Act
                await cast(Any, General.status.callback)(cog, ctx)

                # Assert
                ctx.send.assert_called_once()
                args, kwargs = ctx.send.call_args
                embed = kwargs.get('embed') or args[0]

                self.assertIsInstance(embed, discord.Embed)
                self.assertEqual(embed.title, "Bot Status")

                # Verify fields
                fields = {f.name: f.value for f in embed.fields}
                self.assertEqual(fields["Uptime"], "0:01:00")
                self.assertEqual(fields["Ping"], "50ms")
                self.assertEqual(fields["System Load"], "0.50, 0.40, 0.30")
                self.assertIn("Server ID: 12345", embed.footer.text)

    async def test_on_voice_state_update_auto_disconnect(self):
        # Arrange
        bot = MagicMock()
        cog = General(bot)

        member = MagicMock(spec=discord.Member)
        before = MagicMock(spec=discord.VoiceState)
        after = MagicMock(spec=discord.VoiceState)

        # Scenario 1: Bot is the only one left -> Should disconnect
        voice_client = AsyncMock()
        voice_client.channel.members = [bot] # Only one member
        member.guild.voice_client = voice_client

        # Act
        await cog.on_voice_state_update(member, before, after)

        # Assert
        voice_client.disconnect.assert_called_once_with(force=False)

        # Scenario 2: Bot is NOT the only one left -> Should NOT disconnect
        voice_client.reset_mock()
        voice_client.channel.members = [bot, member] # Two members

        # Act
        await cog.on_voice_state_update(member, before, after)

        # Assert
        voice_client.disconnect.assert_not_called()

        # Scenario 3: Bot is not in a voice channel -> Should NOT disconnect
        member.guild.voice_client = None

        # Act
        await cog.on_voice_state_update(member, before, after)

        # Assert
        # No voice client to disconnect, just ensure no error
