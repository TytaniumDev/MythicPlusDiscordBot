import asyncio
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

from core.models import WoWGroup, WoWPlayer
from services.group_service import GroupService


class TestGroupService(unittest.IsolatedAsyncioTestCase):
    async def test_get_groups_data_no_players(self):
        service = GroupService()
        mock_ctx = AsyncMock()
        mock_ctx.channel.members = []

        result = await service.get_groups_data(mock_ctx)
        self.assertIsNone(result)
        mock_ctx.send.assert_called_once_with("❌ No players found in the channel.")

    @patch("services.group_service.get_debug_players")
    @patch("services.group_service.create_mythic_plus_groups")
    async def test_get_groups_data_debug_mode(
        self, mock_create_groups: MagicMock, mock_get_debug_players: MagicMock
    ):
        service = GroupService()
        mock_ctx = AsyncMock()
        mock_get_debug_players.return_value = [WoWPlayer(name="DebugPlayer")]
        mock_create_groups.return_value = [WoWGroup()]

        result = await service.get_groups_data(mock_ctx, debug=True)

        self.assertIsNotNone(result)
        if result is not None:
            self.assertEqual(len(result["players"]), 1)
            self.assertEqual(len(result["groups"]), 1)

        mock_get_debug_players.assert_called_once()
        mock_create_groups.assert_called_once()

    @patch("services.group_service.get_player_list")
    @patch("services.group_service.create_mythic_plus_groups")
    async def test_get_groups_data_normal_mode(
        self, mock_create_groups: MagicMock, mock_get_player_list: MagicMock
    ):
        service = GroupService()
        mock_ctx = AsyncMock()

        # Create mock members (not bots)
        member1 = MagicMock()
        member1.bot = False
        member2 = MagicMock()
        member2.bot = False
        mock_ctx.channel.members = [member1, member2]

        mock_get_player_list.return_value = [
            WoWPlayer(name="Player1", tankMain=True),
            WoWPlayer(name="Player2", dpsMain=True),
        ]
        mock_create_groups.return_value = [WoWGroup()]

        result = await service.get_groups_data(mock_ctx, debug=False)

        self.assertIsNotNone(result)
        if result is not None:
            self.assertEqual(len(result["players"]), 2)
            self.assertEqual(len(result["groups"]), 1)

        mock_get_player_list.assert_called_once_with([member1, member2])
        mock_create_groups.assert_called_once()

    @patch("services.group_service.get_player_list")
    async def test_get_groups_data_no_valid_roles(
        self, mock_get_player_list: MagicMock
    ):
        """Players without roles are filtered out, resulting in no valid players."""
        service = GroupService()
        mock_ctx = AsyncMock()

        member1 = MagicMock()
        member1.bot = False
        mock_ctx.channel.members = [member1]

        mock_get_player_list.return_value = [WoWPlayer(name="Roleless")]

        result = await service.get_groups_data(mock_ctx, debug=False)

        self.assertIsNone(result)
        mock_ctx.send.assert_called_once_with("❌ No players with valid roles found.")

    async def test_core_wheel_no_guild(self):
        service = GroupService()
        mock_ctx = AsyncMock()
        mock_ctx.guild = None

        await service.core_wheel(mock_ctx)

        mock_ctx.send.assert_called_once_with(
            "❌ This command can only be used in a server."
        )

    @patch("services.group_service.GroupService._execute_core_wheel")
    async def test_core_wheel_successful_execution(
        self, mock_execute_core_wheel: AsyncMock
    ):
        service = GroupService()
        mock_ctx = AsyncMock()
        mock_ctx.guild.id = 123
        mock_ctx.channel = MagicMock()

        await service.core_wheel(mock_ctx)

        mock_execute_core_wheel.assert_awaited_once_with(
            mock_ctx, mock_ctx.channel, 123, False
        )
        self.assertIn(123, service.server_locks)
        self.assertFalse(service.server_locks[123].locked())

    async def test_core_wheel_concurrent_execution(self):
        service = GroupService()
        mock_ctx1 = AsyncMock()
        mock_ctx1.guild.id = 123

        mock_ctx2 = AsyncMock()
        mock_ctx2.guild.id = 123

        from typing import Any

        # We need to simulate a long-running execution for the first call
        # so the second call encounters a locked state.
        async def mock_execute(*args: Any, **kwargs: Any) -> None:
            await asyncio.sleep(0.1)

        with patch.object(
            service, "_execute_core_wheel", side_effect=mock_execute
        ) as mock_execute_core_wheel:
            task1 = asyncio.create_task(service.core_wheel(mock_ctx1))

            # Yield control to let task1 acquire the lock
            await asyncio.sleep(0.01)

            task2 = asyncio.create_task(service.core_wheel(mock_ctx2))

            await asyncio.gather(task1, task2)

            mock_execute_core_wheel.assert_awaited_once()
            mock_ctx2.send.assert_awaited_once_with(
                "⏳ Another group creation is already in progress for this server. Please wait for it to complete."
            )

    @patch("services.group_service.announce_group")
    async def test_execute_core_wheel(self, mock_announce_group: AsyncMock):
        service = GroupService()
        mock_ctx = AsyncMock()
        mock_channel = MagicMock()
        guild_id = 123
        debug = False

        # Mock get_groups_data inside GroupService
        mock_groups_data = {
            "players": [WoWPlayer(name="P1")],
            "groups": [WoWGroup(), WoWGroup()],
        }
        service.get_groups_data = AsyncMock(return_value=mock_groups_data)

        await service._execute_core_wheel(mock_ctx, mock_channel, guild_id, debug)  # pyright: ignore[reportPrivateUsage]

        service.get_groups_data.assert_awaited_once_with(mock_ctx, debug)
        self.assertEqual(service.last_results[guild_id], mock_groups_data)

        self.assertEqual(mock_announce_group.await_count, 2)

    async def test_execute_core_wheel_no_data(self):
        service = GroupService()
        mock_ctx = AsyncMock()
        mock_channel = MagicMock()
        guild_id = 123
        debug = False

        service.get_groups_data = AsyncMock(return_value=None)

        await service._execute_core_wheel(mock_ctx, mock_channel, guild_id, debug)  # pyright: ignore[reportPrivateUsage]

        self.assertNotIn(guild_id, service.last_results)
