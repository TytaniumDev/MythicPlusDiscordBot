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

        cog = Groups(bot)
        cog.session_service.get_or_create_session = AsyncMock(
            return_value=("123", "456")
        )
        ctx = AsyncMock()
        ctx.guild.id = 123
        ctx.author.voice.channel = MagicMock()
        ctx.author.voice.channel.create_invite = AsyncMock()
        ctx.author.voice.channel.create_invite.return_value.url = (
            "http://discord.invite"
        )

        with patch("core.config.DISCORD_APPLICATION_ID", "12345"):
            await cog.activity.callback(cog, ctx)  # type: ignore

            calls = ctx.send.call_args_list
            found_url = False
            default_url = "https://tytaniumdev.github.io/MythicPlusDiscordBot/"
            for call in calls:
                msg = call.args[0]
                if f"{default_url}?guildId=123&channelId=456" in msg:
                    found_url = True
                    break
            self.assertTrue(
                found_url,
                f"Default ACTIVITY_URL {default_url} with guildId+channelId not found in response",
            )

    async def test_activity_command_override_url(self):
        bot = MagicMock()
        bot.group_service = AsyncMock()

        cog = Groups(bot)
        cog.session_service.get_or_create_session = AsyncMock(
            return_value=("123", "456")
        )
        ctx = AsyncMock()
        ctx.guild.id = 123
        ctx.author.voice.channel = MagicMock()
        ctx.author.voice.channel.create_invite = AsyncMock()
        ctx.author.voice.channel.create_invite.return_value.url = (
            "http://discord.invite"
        )

        custom_url = "https://custom.url/"
        with (
            patch("core.config.ACTIVITY_URL", custom_url),
            patch("core.config.DISCORD_APPLICATION_ID", "12345"),
        ):
            await cog.activity.callback(cog, ctx)  # type: ignore

            calls = ctx.send.call_args_list
            found_url = False
            for call in calls:
                msg = call.args[0]
                if f"{custom_url}?guildId=123&channelId=456" in msg:
                    found_url = True
                    break
            self.assertTrue(
                found_url, f"Custom ACTIVITY_URL {custom_url} not found in response"
            )

    async def test_activitytest_command(self):
        bot = MagicMock()
        bot.group_service = AsyncMock()

        cog = Groups(bot)
        cog.session_service.get_or_create_session = AsyncMock(
            return_value=("123", "456")
        )
        ctx = AsyncMock()
        ctx.guild.id = 123
        ctx.author.voice.channel = MagicMock()
        ctx.author.voice.channel.create_invite = AsyncMock()
        ctx.author.voice.channel.create_invite.return_value.url = (
            "http://discord.invite"
        )

        with patch("core.config.DISCORD_APPLICATION_ID", "12345"):
            await cog.activitytest.callback(cog, ctx)  # type: ignore

            calls = ctx.send.call_args_list
            found_url = False
            default_url = "https://tytaniumdev.github.io/MythicPlusDiscordBot/"
            for call in calls:
                msg = call.args[0]
                if f"{default_url}?guildId=123&channelId=456" in msg:
                    found_url = True
                    break
            self.assertTrue(found_url)

    async def test_on_voice_state_update_channel_level_tracking(self):
        """Test that voice state updates check active_channels, not active_sessions."""
        bot = MagicMock()

        with patch("cogs.groups.SessionService") as MockSessionService:
            cog = Groups(bot)
            mock_service_instance = MockSessionService.return_value

            # Simulate active channel tracking
            from services.session_service import ActiveChannel

            mock_service_instance.active_channels = {
                123: ActiveChannel(doc_id="123", guild_id=456)
            }
            mock_service_instance.update_channel_players = AsyncMock()
            mock_service_instance.cleanup_channel = AsyncMock()

            # Mock Member with guild
            member = MagicMock()
            member.bot = False
            member.guild = MagicMock()
            member.guild.id = 456

            # Case 1: Join a tracked channel
            before = MagicMock()
            before.channel = None

            after = MagicMock()
            after.channel = MagicMock()
            after.channel.id = 123
            after.channel.members = [member]

            await cog.on_voice_state_update(member, before, after)

            mock_service_instance.update_channel_players.assert_called_with(
                123, member.guild
            )
            mock_service_instance.update_channel_players.reset_mock()

            # Case 2: Leave a tracked channel (still has humans)
            human = MagicMock()
            human.bot = False
            before_leave = MagicMock()
            before_leave.channel = MagicMock()
            before_leave.channel.id = 123
            before_leave.channel.members = [human]

            after_leave = MagicMock()
            after_leave.channel = None

            await cog.on_voice_state_update(member, before_leave, after_leave)

            mock_service_instance.update_channel_players.assert_called_with(
                123, member.guild
            )
            mock_service_instance.cleanup_channel.assert_not_called()

            # Case 3: No Channel Change (e.g. Mute) - Should NOT update
            mock_service_instance.update_channel_players.reset_mock()
            channel_obj = MagicMock()
            channel_obj.id = 123

            before_mute = MagicMock()
            before_mute.channel = channel_obj

            after_mute = MagicMock()
            after_mute.channel = channel_obj

            await cog.on_voice_state_update(member, before_mute, after_mute)

            self.assertEqual(mock_service_instance.update_channel_players.call_count, 0)

    async def test_on_voice_state_update_cleanup_empty_channel(self):
        """Test that leaving a tracked channel with no humans triggers cleanup."""
        bot = MagicMock()

        with patch("cogs.groups.SessionService") as MockSessionService:
            cog = Groups(bot)
            mock_service_instance = MockSessionService.return_value

            from services.session_service import ActiveChannel

            mock_service_instance.active_channels = {
                123: ActiveChannel(doc_id="123", guild_id=456)
            }
            mock_service_instance.update_channel_players = AsyncMock()
            mock_service_instance.cleanup_channel = AsyncMock()

            member = MagicMock()
            member.bot = False
            member.guild = MagicMock()
            member.guild.id = 456

            # Leave with only bots remaining
            bot_member = MagicMock()
            bot_member.bot = True

            before = MagicMock()
            before.channel = MagicMock()
            before.channel.id = 123
            before.channel.members = [bot_member]  # only bots left

            after = MagicMock()
            after.channel = None

            await cog.on_voice_state_update(member, before, after)

            mock_service_instance.cleanup_channel.assert_called_once_with(123)


if __name__ == "__main__":
    unittest.main()
