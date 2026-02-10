import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

import discord

# Add project root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.models import WoWGroup, WoWPlayer
from services.group_service import GroupService


class TestGroupService(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.service = GroupService()
        self.ctx = AsyncMock()
        self.ctx.guild.id = 12345
        self.ctx.channel = AsyncMock()
        self.ctx.send = AsyncMock()

    @patch("services.group_service.get_debug_players")
    @patch("services.group_service.create_mythic_plus_groups")
    async def test_get_groups_data_debug(
        self, mock_create_groups: MagicMock, mock_debug_players: MagicMock
    ):
        """Test get_groups_data in debug mode."""
        mock_debug_players.return_value = [MagicMock(spec=WoWPlayer)]
        mock_create_groups.return_value = [MagicMock(spec=WoWGroup)]

        result = await self.service.get_groups_data(self.ctx, debug=True)

        self.assertIsNotNone(result)
        assert result is not None
        mock_debug_players.assert_called_once()
        mock_create_groups.assert_called_once()
        self.assertEqual(len(result["players"]), 1)
        self.assertEqual(len(result["groups"]), 1)

    @patch("services.group_service.get_player_list")
    @patch("services.group_service.create_mythic_plus_groups")
    async def test_get_groups_data_normal(
        self, mock_create_groups: MagicMock, mock_get_players: MagicMock
    ):
        """Test get_groups_data in normal mode with players."""
        member = MagicMock(spec=discord.Member)
        member.bot = False
        self.ctx.channel.members = [member]

        mock_get_players.return_value = [MagicMock(spec=WoWPlayer)]
        mock_create_groups.return_value = [MagicMock(spec=WoWGroup)]

        result = await self.service.get_groups_data(self.ctx, debug=False)

        self.assertIsNotNone(result)
        mock_get_players.assert_called_once()
        mock_create_groups.assert_called_once()

    async def test_get_groups_data_no_members(self):
        """Test get_groups_data with no members in channel."""
        self.ctx.channel.members = []

        result = await self.service.get_groups_data(self.ctx, debug=False)

        self.assertIsNone(result)
        self.ctx.send.assert_called_with("❌ No players found in the channel.")

    @patch("services.group_service.get_player_list")
    async def test_get_groups_data_no_valid_roles(self, mock_get_players: MagicMock):
        """Test get_groups_data with members but no valid roles."""
        member = MagicMock(spec=discord.Member)
        member.bot = False
        self.ctx.channel.members = [member]

        mock_get_players.return_value = []

        result = await self.service.get_groups_data(self.ctx, debug=False)

        self.assertIsNone(result)
        self.ctx.send.assert_called_with("❌ No players with valid roles found.")

    async def test_core_wheel_locking(self):
        """Test that core_wheel acquires a lock."""
        # Mock _execute_core_wheel to verify it's called
        self.service._execute_core_wheel = AsyncMock()  # pyright: ignore[reportPrivateUsage]

        await self.service.core_wheel(self.ctx, debug_value=False)

        self.assertIn(12345, self.service.server_locks)
        self.service._execute_core_wheel.assert_called_once()  # pyright: ignore[reportPrivateUsage]

    async def test_core_wheel_already_locked(self):
        """Test that core_wheel respects existing lock."""
        # Manually lock
        import asyncio

        self.service.server_locks[12345] = asyncio.Lock()
        await self.service.server_locks[12345].acquire()

        self.service._execute_core_wheel = AsyncMock()  # pyright: ignore[reportPrivateUsage]

        await self.service.core_wheel(self.ctx, debug_value=False)

        self.service._execute_core_wheel.assert_not_called()  # pyright: ignore[reportPrivateUsage]
        self.ctx.send.assert_called_with(
            "⏳ Another group creation is already in progress for this server. Please wait for it to complete."
        )

    @patch("services.group_service.show_short_typing")
    @patch("services.group_service.get_masked_name")
    async def test_announce_group(self, mock_masked: MagicMock, mock_typing: AsyncMock):
        """Test announcement sequence."""
        mock_masked.side_effect = lambda x: f"Masked({x})"  # pyright: ignore[reportUnknownLambdaType]

        group = MagicMock(spec=WoWGroup)
        group.tank = MagicMock()
        group.tank.name = "TankName"
        group.tank.hasBrez = True  # Tank has Brez
        group.tank.hasLust = False
        group.tank.toTestString.return_value = "TankName"

        group.healer = MagicMock()
        group.healer.name = "HealerName"
        group.healer.hasBrez = False
        group.healer.hasLust = True  # Healer has Lust
        group.healer.toTestString.return_value = "HealerName"

        dps1 = MagicMock()
        dps1.name = "DPS1"
        dps1.hasBrez = False
        dps1.hasLust = False

        dps2 = MagicMock()
        dps2.name = "DPS2"
        dps2.hasBrez = False
        dps2.hasLust = False

        dps3 = MagicMock()
        dps3.name = "DPS3"
        dps3.hasBrez = False
        dps3.hasLust = False

        group.dps = [dps1, dps2, dps3]

        # Mock context send to return a message that can be edited
        mock_message = AsyncMock()
        # Important: make edit return the same mock object so subsequent edits are tracked on it
        mock_message.edit.return_value = mock_message
        self.ctx.send.return_value = mock_message

        # We need to ensure that finding utility players works correctly with MagicMocks
        # The code iterates over [tank, healer] + dps and checks hasBrez/hasLust
        # Since we set attributes on the mocks, it should work.

        await self.service._announce_group(  # pyright: ignore[reportPrivateUsage]
            self.ctx, self.ctx.channel, group, 1, debug=False
        )

        # Initial send
        self.ctx.send.assert_called_once()
        embed = self.ctx.send.call_args.kwargs["embed"]
        self.assertEqual(embed.title, "Group 1")

        # Verify edits
        # It edits for Tank, Healer, DPS1, DPS2, DPS3 (actually DPS field is updated 3 times), Brez, Lust
        # 1. send(embed)
        # 2. edit(tank)
        # 3. edit(healer)
        # 4. edit(dps1)
        # 5. edit(dps2)
        # 6. edit(dps3)
        # 7. edit(brez)
        # 8. edit(lust)
        self.assertEqual(mock_message.edit.call_count, 7)
        self.assertEqual(mock_typing.call_count, 5)  # Typing before each role reveal


if __name__ == "__main__":
    unittest.main()
