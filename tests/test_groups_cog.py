import os
import sys
import unittest
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

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
            await cast(Any, Groups.badgroup.callback)(
                cog, ctx, title=None, description=None
            )

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

        with patch(
            "cogs.groups.report_bad_group", new_callable=AsyncMock
        ) as mock_report:
            mock_report.return_value = {"html_url": "http://url"}

            await cast(Any, Groups.badgroup.callback)(
                cog, ctx, title="Title", description="Desc"
            )

            mock_report.assert_called_once_with(
                ctx.author,
                {"players": [], "groups": []},
                "Title",
                "Desc",
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

        await cast(Any, Groups.badgroup.callback)(
            cog, ctx, title=None, description=None
        )

        ctx.send.assert_called_once_with(
            "❌ No group creation data found for this server. Run /wheel first.",
            ephemeral=True,
        )

    async def test_activity_command_default_url(self):
        bot = MagicMock()
        bot.group_service = AsyncMock()

        # Mocking players and groups
        player = MagicMock()
        player.name = "TestPlayer"
        player.tankMain = True
        player.offtank = False
        player.healerMain = False
        player.offhealer = False
        player.dpsMain = False
        player.offdps = False

        group = MagicMock()
        group.tank = player
        group.healer = None
        group.dps = []

        bot.group_service.get_groups_data.return_value = {
            "players": [player],
            "groups": [group],
        }
        bot.group_service.last_results = {}

        cog = Groups(bot)
        cog.session_service.create_session = AsyncMock(return_value="session-123")
        ctx = AsyncMock()
        ctx.guild.id = 123
        ctx.author.voice.channel = MagicMock()
        ctx.author.voice.channel.create_invite = AsyncMock()
        ctx.author.voice.channel.create_invite.return_value.url = (
            "http://discord.invite"
        )

        # We don't patch core.config.ACTIVITY_URL here because we want to test the default
        with patch("core.config.DISCORD_APPLICATION_ID", "12345"):
            await cog.activity.callback(cog, ctx)  # type: ignore

            # Check if the message contains the default URL with sessionId (Firebase flow)
            calls = ctx.send.call_args_list
            found_url = False
            default_url = "https://tytaniumdev.github.io/MythicPlusDiscordBot/"
            for call in calls:
                msg = call.args[0]
                if f"{default_url}?sessionId=" in msg:
                    found_url = True
                    break
            self.assertTrue(
                found_url, f"Default ACTIVITY_URL {default_url} not found in response"
            )

    async def test_activity_command_override_url(self):
        bot = MagicMock()
        bot.group_service = AsyncMock()

        # Mocking players and groups
        player = MagicMock()
        player.name = "TestPlayer"
        player.tankMain = True
        player.offtank = False
        player.healerMain = False
        player.offhealer = False
        player.dpsMain = False
        player.offdps = False

        group = MagicMock()
        group.tank = player
        group.healer = None
        group.dps = []

        bot.group_service.get_groups_data.return_value = {
            "players": [player],
            "groups": [group],
        }
        bot.group_service.last_results = {}

        cog = Groups(bot)
        cog.session_service.create_session = AsyncMock(return_value="session-456")
        ctx = AsyncMock()
        ctx.guild.id = 123
        ctx.author.voice.channel = MagicMock()
        ctx.author.voice.channel.create_invite = AsyncMock()
        ctx.author.voice.channel.create_invite.return_value.url = (
            "http://discord.invite"
        )

        # Patch core.config.ACTIVITY_URL to simulate override
        custom_url = "https://custom.url/"
        with (
            patch("core.config.ACTIVITY_URL", custom_url),
            patch("core.config.DISCORD_APPLICATION_ID", "12345"),
        ):
            await cog.activity.callback(cog, ctx)  # type: ignore

            # Check if the message contains the custom URL with sessionId (Firebase flow)
            calls = ctx.send.call_args_list
            found_url = False
            for call in calls:
                msg = call.args[0]
                if f"{custom_url}?sessionId=" in msg:
                    found_url = True
                    break
            self.assertTrue(
                found_url, f"Custom ACTIVITY_URL {custom_url} not found in response"
            )


if __name__ == "__main__":
    unittest.main()
