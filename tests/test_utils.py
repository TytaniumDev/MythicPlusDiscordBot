import os
import sys
import unittest
from typing import cast
from unittest.mock import AsyncMock, MagicMock, patch

import discord

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.utils import (  # noqa: E402, I001
    get_debug_players,
    get_masked_name,
    get_player_list,
    get_wow_name,
    show_long_typing,
    show_short_typing,
)


class TestUtils(unittest.TestCase):
    def test_get_wow_name_priority(self):
        """Test that get_wow_name prioritizes Nick > Global > Str and removes dots."""
        # Case 1: Nickname exists
        member = MagicMock()
        member.nick = "Nick.Name"
        # global_name should be ignored if nick is present
        member.global_name = "Global.Name"
        self.assertEqual(get_wow_name(member), "NickName")

        # Case 2: No nick, global name exists
        member.nick = None
        member.global_name = "Global.Name"
        self.assertEqual(get_wow_name(member), "GlobalName")

        # Case 3: No nick, no global name, fallback to string representation
        member.nick = None
        member.global_name = None
        member.__str__.return_value = "User.Name"
        self.assertEqual(get_wow_name(member), "UserName")

    def test_get_debug_players(self):
        """Test that get_debug_players returns a valid list of WoWPlayer objects."""
        players = get_debug_players()
        self.assertGreater(len(players), 0)
        for player in players:
            self.assertIsNotNone(player.name)
            self.assertTrue(player.hasRoles())

    @patch("core.utils.get_preference_service")
    def test_get_player_list(self, mock_get_svc: MagicMock):
        """Test that get_player_list returns all members, with or without roles."""
        mock_svc = MagicMock()
        mock_get_svc.return_value = mock_svc

        # Setup members
        member_saved = MagicMock()
        member_saved.nick = "SavedPlayer"
        member_saved.id = 111

        member_no_roles = MagicMock()
        member_no_roles.nick = "NoRolesPlayer"
        member_no_roles.id = 222

        member_another = MagicMock()
        member_another.nick = "AnotherPlayer"
        member_another.id = 333

        members = [member_saved, member_no_roles, member_another]

        # Setup mock preferences
        def sync_pref(discord_id: str):
            if discord_id == "111":
                return ["Tank"]
            return None

        mock_svc.get_preference_sync.side_effect = sync_pref
        mock_svc.get_preference_by_name_sync.return_value = None

        # Call function
        players = get_player_list(cast(list[discord.Member], members))

        # All 3 members are returned
        self.assertEqual(len(players), 3)

        # Verify SavedPlayer has roles
        p1 = next((p for p in players if p.name == "SavedPlayer"), None)
        assert p1 is not None
        self.assertTrue(p1.tankMain)
        self.assertTrue(p1.hasRoles())
        self.assertEqual(p1.discordId, "111")

        # Verify players without saved roles have no roles
        p2 = next((p for p in players if p.name == "NoRolesPlayer"), None)
        assert p2 is not None
        self.assertFalse(p2.hasRoles())
        self.assertEqual(p2.discordId, "222")

        p3 = next((p for p in players if p.name == "AnotherPlayer"), None)
        assert p3 is not None
        self.assertFalse(p3.hasRoles())


class TestMaskedName(unittest.TestCase):
    def test_get_masked_name(self):
        """Test get_masked_name returns question marks equal to string length."""
        self.assertEqual(get_masked_name("abc"), "???")
        self.assertEqual(get_masked_name(""), "")
        self.assertEqual(get_masked_name("hello world"), "???????????")


class TestTyping(unittest.IsolatedAsyncioTestCase):
    @patch("asyncio.sleep")
    async def test_show_long_typing(self, mock_sleep: AsyncMock):
        """Test show_long_typing sleeps for 2s unless debug."""
        channel = MagicMock()
        channel.typing.return_value.__aenter__.return_value = None
        channel.typing.return_value.__aexit__.return_value = None

        # Debug = False -> Sleep 2
        await show_long_typing(channel, debug_mode=False)
        mock_sleep.assert_called_with(2)

        mock_sleep.reset_mock()

        # Debug = True -> No sleep
        await show_long_typing(channel, debug_mode=True)
        mock_sleep.assert_not_called()

    @patch("asyncio.sleep")
    async def test_show_short_typing(self, mock_sleep: AsyncMock):
        """Test show_short_typing sleeps for 1s unless debug."""
        channel = MagicMock()
        channel.typing.return_value.__aenter__.return_value = None
        channel.typing.return_value.__aexit__.return_value = None

        # Debug = False -> Sleep 1
        await show_short_typing(channel, debug_mode=False)
        mock_sleep.assert_called_with(1)

        mock_sleep.reset_mock()

        # Debug = True -> No sleep
        await show_short_typing(channel, debug_mode=True)
        mock_sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
