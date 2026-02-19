import asyncio
import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Add project root to sys.path to allow imports from core
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.group_service import GroupService


class TestGroupService(unittest.IsolatedAsyncioTestCase):
    async def test_get_groups_data_no_players(self):
        """Test that get_groups_data returns None if no players are in the channel."""
        service = GroupService()
        ctx = AsyncMock()
        # Mock channel members as empty
        ctx.channel.members = []

        result = await service.get_groups_data(ctx)

        self.assertIsNone(result)
        ctx.send.assert_called_with("❌ No players found in the channel.")

    @patch("services.group_service.get_player_list")
    async def test_get_groups_data_no_valid_roles(
        self, mock_get_player_list: MagicMock
    ):
        """Test that get_groups_data returns None if players exist but have no valid roles."""
        service = GroupService()
        ctx = AsyncMock()

        member = MagicMock()
        member.bot = False
        ctx.channel.members = [member]

        # Mock get_player_list to return empty list (no valid roles found)
        mock_get_player_list.return_value = []

        result = await service.get_groups_data(ctx)

        self.assertIsNone(result)
        ctx.send.assert_called_with("❌ No players with valid roles found.")

    async def test_core_wheel_concurrent_lock(self):
        """Test that core_wheel prevents concurrent executions for the same guild."""
        service = GroupService()
        ctx = AsyncMock()
        ctx.guild.id = 123

        # Manually acquire the lock for this guild to simulate a running process
        service.server_locks[123] = asyncio.Lock()
        await service.server_locks[123].acquire()

        # Try to run core_wheel while locked
        await service.core_wheel(ctx)

        # Verify it sent the "already in progress" message
        ctx.send.assert_called_with(
            "⏳ Another group creation is already in progress for this server. Please wait for it to complete."
        )

        # Release lock to clean up (optional but good practice)
        service.server_locks[123].release()

    @patch("services.group_service.announce_group", new_callable=AsyncMock)
    @patch("services.group_service.create_mythic_plus_groups")
    @patch("services.group_service.get_player_list")
    async def test_core_wheel_success(
        self,
        mock_get_player_list: MagicMock,
        mock_create_groups: MagicMock,
        mock_announce: AsyncMock,
    ):
        """Test the happy path where groups are successfully created and announced."""
        service = GroupService()
        ctx = AsyncMock()
        ctx.guild.id = 123
        ctx.channel = MagicMock()

        member = MagicMock()
        member.bot = False
        ctx.channel.members = [member]

        # Mock valid players and groups
        mock_player = MagicMock()
        mock_player.name = "TestPlayer"
        mock_get_player_list.return_value = [mock_player]

        mock_group = MagicMock()
        mock_create_groups.return_value = [mock_group]

        await service.core_wheel(ctx)

        # Verify results were stored
        self.assertIn(123, service.last_results)
        self.assertEqual(service.last_results[123]["groups"], [mock_group])

        # Verify announce_group was called
        mock_announce.assert_called_once_with(ctx, ctx.channel, mock_group, 1, False)


if __name__ == "__main__":
    unittest.main()
