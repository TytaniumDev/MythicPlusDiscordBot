import os
import sys
import unittest
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock, patch

import discord

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from cogs.roles import Roles  # noqa: E402


class TestRolesCog(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.bot = AsyncMock()
        self.cog = Roles(self.bot)

    @patch("cogs.roles.RoleBoardView")
    @patch("cogs.roles.create_role_board_embed")
    @patch("cogs.roles.get_player_list")
    async def test_launch_role_board_success(
        self,
        mock_get_players: MagicMock,
        mock_create_embed: MagicMock,
        mock_view: MagicMock,
    ):
        """Test launching the role board successfully."""
        ctx = AsyncMock()
        ctx.guild = MagicMock()
        ctx.author.voice.channel = MagicMock()
        ctx.author.voice.channel.members = [MagicMock()]

        mock_get_players.return_value = []
        mock_create_embed.return_value = discord.Embed(title="Test Board")

        await self.cog._launch_role_board(ctx)  # pyright: ignore[reportPrivateUsage]

        mock_get_players.assert_called_once()
        mock_create_embed.assert_called_once()
        mock_view.assert_called_once()
        ctx.send.assert_called_once()

        # Verify call arguments
        call_kwargs = ctx.send.call_args.kwargs
        self.assertIn("embed", call_kwargs)
        self.assertIn("view", call_kwargs)

    async def test_launch_role_board_no_guild(self):
        """Test launching role board outside of a guild (DM)."""
        ctx = AsyncMock()
        ctx.guild = None
        # AsyncMock creates attributes on access, so explicitly set interaction to None
        ctx.interaction = None

        await self.cog._launch_role_board(ctx)  # pyright: ignore[reportPrivateUsage]

        ctx.send.assert_called_with("❌ This command can only be used in a server.")

    @patch("cogs.roles.get_wow_name")
    @patch("cogs.roles.get_player_preference")
    async def test_rolecheck_with_saved_roles(
        self, mock_get_pref: MagicMock, mock_wowname: MagicMock
    ):
        """Test rolecheck with a user who has saved roles."""
        ctx = AsyncMock()
        member = MagicMock()
        member.bot = False
        ctx.author.voice.channel.members = [member]

        mock_wowname.return_value = "TestPlayer"
        mock_get_pref.return_value = ["Tank", "Healer"]

        await cast(Any, self.cog.rolecheck.callback)(self.cog, ctx)

        ctx.send.assert_called_once()
        # Check if embed was sent
        call_args = ctx.send.call_args
        self.assertIn("embed", call_args.kwargs)
        embed = call_args.kwargs["embed"]
        self.assertEqual(embed.fields[0].name, "TestPlayer")
        self.assertEqual(embed.fields[0].value, "Tank, Healer")

    @patch("cogs.roles.get_wow_name")
    @patch("cogs.roles.get_player_preference")
    async def test_rolecheck_discord_roles_only(
        self, mock_get_pref: MagicMock, mock_wowname: MagicMock
    ):
        """Test rolecheck with a user who has no saved roles but has Discord roles."""
        ctx = AsyncMock()
        member = MagicMock()
        member.bot = False
        role = MagicMock()
        # Ensure the role name is in ALL_ROLES
        role.name = "Tank"
        member.roles = [role]
        ctx.author.voice.channel.members = [member]

        mock_wowname.return_value = "DiscordUser"
        mock_get_pref.return_value = None

        # Ensure Tank is in ALL_ROLES for the test context
        with patch("cogs.roles.ALL_ROLES", ["Tank"]):
            await cast(Any, self.cog.rolecheck.callback)(self.cog, ctx)

        ctx.send.assert_called_once()
        call_args = ctx.send.call_args
        embed = call_args.kwargs.get("embed")

        self.assertIsNotNone(embed)
        self.assertIn("DiscordUser (Discord Only)", embed.fields[0].name)
        self.assertIn("Tank", embed.fields[0].value)

    async def test_rolecheck_empty_channel(self):
        """Test rolecheck when no members are found."""
        ctx = AsyncMock()
        ctx.author.voice.channel.members = []

        await cast(Any, self.cog.rolecheck.callback)(self.cog, ctx)

        ctx.send.assert_called_with("No members found in the channel.")

    @patch("cogs.roles.clear_player_preference")
    @patch("cogs.roles.get_wow_name")
    async def test_clearrole_self(self, mock_wowname: MagicMock, mock_clear: MagicMock):
        """Test clearing own roles."""
        ctx = AsyncMock()
        ctx.author.id = 123
        mock_wowname.return_value = "MyName"
        mock_clear.return_value = True

        await cast(Any, self.cog.clearrole.callback)(self.cog, ctx, name=None)

        # Should be called for both ID and name
        self.assertEqual(mock_clear.call_count, 2)
        mock_clear.assert_any_call("123")
        mock_clear.assert_any_call("MyName")
        ctx.send.assert_called_with("✅ Cleared your saved roles, **MyName**.")

    @patch("cogs.roles.get_wow_name")
    @patch("cogs.roles.clear_player_preference")
    async def test_clearrole_other(
        self, mock_clear: MagicMock, mock_wowname: MagicMock
    ):
        """Test clearing another player's roles."""
        ctx = AsyncMock()
        member = MagicMock(spec=discord.Member)
        member.id = 456
        ctx.guild.members = [member]
        mock_wowname.return_value = "OtherPlayer"
        mock_clear.return_value = True

        await cast(Any, self.cog.clearrole.callback)(self.cog, ctx, name="OtherPlayer")

        mock_clear.assert_called_with("456")
        ctx.send.assert_called_with("✅ Cleared saved roles for **OtherPlayer**.")

    @patch("cogs.roles.clear_player_preference")
    async def test_clearrole_failure(self, mock_clear: MagicMock):
        """Test clearing roles when none exist."""
        ctx = AsyncMock()
        ctx.guild.members = []
        mock_clear.return_value = False

        await cast(Any, self.cog.clearrole.callback)(self.cog, ctx, name="Unknown")

        ctx.send.assert_called_with("❌ No saved roles found for **Unknown**.")


if __name__ == "__main__":
    unittest.main()
