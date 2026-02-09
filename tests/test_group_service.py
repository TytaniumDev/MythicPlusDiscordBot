import sys
import os
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from services.group_service import GroupService

class TestGroupService(unittest.IsolatedAsyncioTestCase):
    @patch("services.group_service.create_mythic_plus_groups")
    @patch("services.group_service.get_player_list")
    async def test_get_groups_data_success(
        self, mock_get_player_list, mock_create_groups
    ):
        service = GroupService()
        ctx = AsyncMock()
        member = MagicMock()
        member.bot = False
        ctx.channel.members = [member]

        mock_players = [MagicMock()]
        mock_get_player_list.return_value = mock_players
        mock_groups = [MagicMock()]
        mock_create_groups.return_value = mock_groups

        result = await service.get_groups_data(ctx, debug=False)

        mock_get_player_list.assert_called_once_with([member])
        mock_create_groups.assert_called_once_with(mock_players, debug=False)
        self.assertEqual(result, {"players": mock_players, "groups": mock_groups})
