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

    @patch("cogs.roles.get_preference_service")
    @patch("cogs.roles.get_wow_name")
    async def test_rolecheck_with_saved_roles(
        self, mock_wowname: MagicMock, mock_get_svc: MagicMock
    ):
        """Test rolecheck with a user who has saved roles."""
        mock_svc = MagicMock()
        mock_get_svc.return_value = mock_svc
        mock_svc.get_preference_sync.return_value = ["Tank", "Healer"]
        mock_svc.get_preference_by_name_sync.return_value = None

        ctx = AsyncMock()
        member = MagicMock()
        member.bot = False
        member.id = 111
        ctx.author.voice.channel.members = [member]

        mock_wowname.return_value = "TestPlayer"

        await cast(Any, self.cog.rolecheck.callback)(self.cog, ctx)

        ctx.send.assert_called_once()
        # Check if embed was sent
        call_args = ctx.send.call_args
        self.assertIn("embed", call_args.kwargs)
        embed = call_args.kwargs["embed"]
        self.assertEqual(embed.fields[0].name, "TestPlayer")
        self.assertEqual(embed.fields[0].value, "Tank, Healer")

    @patch("cogs.roles.get_preference_service")
    @patch("cogs.roles.get_wow_name")
    async def test_rolecheck_no_saved_roles(
        self, mock_wowname: MagicMock, mock_get_svc: MagicMock
    ):
        """Test rolecheck with a user who has no saved roles shows 'No roles set'."""
        mock_svc = MagicMock()
        mock_get_svc.return_value = mock_svc
        mock_svc.get_preference_sync.return_value = None
        mock_svc.get_preference_by_name_sync.return_value = None

        ctx = AsyncMock()
        member = MagicMock()
        member.bot = False
        member.id = 222
        ctx.author.voice.channel.members = [member]

        mock_wowname.return_value = "NewUser"

        await cast(Any, self.cog.rolecheck.callback)(self.cog, ctx)

        ctx.send.assert_called_once()
        call_args = ctx.send.call_args
        embed = call_args.kwargs.get("embed")

        self.assertIsNotNone(embed)
        self.assertEqual(embed.fields[0].name, "NewUser")
        self.assertIn("No roles set", embed.fields[0].value)

    async def test_rolecheck_empty_channel(self):
        """Test rolecheck when no members are found."""
        ctx = AsyncMock()
        ctx.author.voice.channel.members = []

        await cast(Any, self.cog.rolecheck.callback)(self.cog, ctx)

        ctx.send.assert_called_with("No members found in the channel.")

    @patch("cogs.roles.get_preference_service")
    @patch("cogs.roles.get_wow_name")
    async def test_clearrole_self(
        self, mock_wowname: MagicMock, mock_get_svc: MagicMock
    ):
        """Test clearing own roles."""
        mock_svc = MagicMock()
        mock_svc.get_preference_sync.return_value = ["Tank"]
        mock_svc.clear_preference = AsyncMock()
        mock_get_svc.return_value = mock_svc

        ctx = AsyncMock()
        ctx.author.id = 123
        mock_wowname.return_value = "MyName"

        await cast(Any, self.cog.clearrole.callback)(self.cog, ctx, name=None)

        mock_svc.clear_preference.assert_called_with("123")
        ctx.send.assert_called_with("✅ Cleared your saved roles, **MyName**.")

    @patch("cogs.roles.get_preference_service")
    async def test_clearrole_other(self, mock_get_svc: MagicMock):
        """Test clearing another player's roles."""
        mock_svc = MagicMock()
        mock_svc.resolve_discord_id.return_value = "456"
        mock_svc.clear_preference = AsyncMock()
        mock_get_svc.return_value = mock_svc

        ctx = AsyncMock()

        await cast(Any, self.cog.clearrole.callback)(self.cog, ctx, name="OtherPlayer")

        mock_svc.clear_preference.assert_called_with("456")
        ctx.send.assert_called_with("✅ Cleared saved roles for **OtherPlayer**.")

    @patch("cogs.roles.get_preference_service")
    async def test_clearrole_failure(self, mock_get_svc: MagicMock):
        """Test clearing roles when none exist."""
        mock_svc = MagicMock()
        mock_svc.resolve_discord_id.return_value = None
        mock_get_svc.return_value = mock_svc

        ctx = AsyncMock()

        await cast(Any, self.cog.clearrole.callback)(self.cog, ctx, name="Unknown")

        ctx.send.assert_called_with("❌ No saved roles found for **Unknown**.")


if __name__ == "__main__":
    unittest.main()
