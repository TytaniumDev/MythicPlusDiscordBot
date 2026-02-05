import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import discord

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cogs.groups import Groups  # noqa: E402, I001


class TestGroupsCog(unittest.IsolatedAsyncioTestCase):
    async def test_badgroup_command_success(self):
        bot = MagicMock()
        bot.group_service = MagicMock()
        bot.group_service.last_results = {123: {"players": [], "groups": []}}

        cog = Groups(bot)

        interaction = AsyncMock(spec=discord.Interaction)
        interaction.guild_id = 123
        interaction.response = AsyncMock()

        with patch("cogs.groups.BadGroupIssueModal") as mock_modal_cls:
            await cog.badgroup.callback(cog, interaction)

            mock_modal_cls.assert_called_once_with({"players": [], "groups": []})
            interaction.response.send_modal.assert_called_once()

    async def test_badgroup_command_no_data(self):
        bot = MagicMock()
        bot.group_service = MagicMock()
        bot.group_service.last_results = {}

        cog = Groups(bot)

        interaction = AsyncMock(spec=discord.Interaction)
        interaction.guild_id = 123
        interaction.response = AsyncMock()

        await cog.badgroup.callback(cog, interaction)

        interaction.response.send_message.assert_called_once_with(
            "❌ No group creation data found for this server. Run /wheel first.",
            ephemeral=True,
        )


if __name__ == "__main__":
    unittest.main()
