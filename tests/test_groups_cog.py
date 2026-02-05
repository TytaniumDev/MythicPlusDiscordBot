import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import discord

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cogs.groups import Groups  # noqa: E402, I001


class TestGroupsCog(unittest.IsolatedAsyncioTestCase):
    async def test_badgroup_command_modal_flow(self):
        bot = MagicMock()
        bot.group_service = MagicMock()
        bot.group_service.last_results = {123: {"players": [], "groups": []}}

        cog = Groups(bot)

        # Mock Context
        ctx = AsyncMock()
        ctx.guild.id = 123
        ctx.interaction = MagicMock()  # Simulating slash command call
        ctx.interaction.response = AsyncMock()

        with patch("cogs.groups.BadGroupIssueModal") as mock_modal_cls:
            await cog.badgroup.callback(cog, ctx, title=None, description=None)

            mock_modal_cls.assert_called_once_with({"players": [], "groups": []})
            ctx.interaction.response.send_modal.assert_called_once()

    async def test_badgroup_command_direct_report(self):
        bot = MagicMock()
        bot.group_service = MagicMock()
        bot.group_service.last_results = {123: {"players": [], "groups": []}}

        cog = Groups(bot)

        # Mock Context
        ctx = AsyncMock()
        ctx.guild.id = 123
        ctx.author = MagicMock()
        ctx.interaction = None  # Simulating prefix command call

        with patch("cogs.groups.report_bad_group", new_callable=AsyncMock) as mock_report:
            mock_report.return_value = {"html_url": "http://url"}

            await cog.badgroup.callback(cog, ctx, title="Title", description="Desc")

            mock_report.assert_called_once_with(
                ctx.author, {"players": [], "groups": []}, "Title", "Desc"
            )
            ctx.send.assert_called_with(
                "✅ Bad group reported successfully: http://url", ephemeral=True
            )

    async def test_badgroup_command_no_data(self):
        bot = MagicMock()
        bot.group_service = MagicMock()
        bot.group_service.last_results = {}

        cog = Groups(bot)

        # Mock Context
        ctx = AsyncMock()
        ctx.guild.id = 123

        await cog.badgroup.callback(cog, ctx, title=None, description=None)

        ctx.send.assert_called_once_with(
            "❌ No group creation data found for this server. Run /wheel first.",
            ephemeral=True,
        )


if __name__ == "__main__":
    unittest.main()
