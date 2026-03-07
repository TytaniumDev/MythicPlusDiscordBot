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

    @patch("core.utils.clear_player_preference")
    @patch("core.utils.set_player_preference")
    @patch("core.utils.get_player_preference")
    def test_get_player_list(
        self,
        mock_get_pref: MagicMock,
        mock_set_pref: MagicMock,
        mock_clear_pref: MagicMock,
    ):
        """Test that get_player_list correctly creates WoWPlayer objects from members."""
        # Setup members
        role_everyone = MagicMock()
        role_everyone.name = "@everyone"

        role_dps = MagicMock()
        role_dps.name = "DPS"

        member_saved = MagicMock()
        member_saved.id = 111
        member_saved.nick = "SavedPlayer"
        member_saved.roles = [role_everyone]

        member_discord = MagicMock()
        member_discord.id = 222
        member_discord.nick = "DiscordPlayer"
        member_discord.roles = [role_everyone, role_dps]

        member_invalid = MagicMock()
        member_invalid.id = 333
        member_invalid.nick = "InvalidPlayer"
        member_invalid.roles = [role_everyone]  # No saved roles, no extra discord roles

        members = [member_saved, member_discord, member_invalid]

        # Setup mock preferences
        def get_pref_side_effect(key: str):
            if key == "111":
                return ["Tank"]
            return None

        mock_get_pref.side_effect = get_pref_side_effect

        # Call function
        players = get_player_list(cast(list[discord.Member], members))

        # Assertions
        self.assertEqual(len(players), 2)

        # Verify SavedPlayer
        p1 = next((p for p in players if p.name == "SavedPlayer"), None)
        assert p1 is not None
        self.assertTrue(p1.tankMain)

        # Verify DiscordPlayer
        p2 = next((p for p in players if p.name == "DiscordPlayer"), None)
        assert p2 is not None
        self.assertTrue(p2.dpsMain)

        # Verify InvalidPlayer is skipped
        p3 = next((p for p in players if p.name == "InvalidPlayer"), None)
        self.assertIsNone(p3)

    @patch("core.utils.clear_player_preference")
    @patch("core.utils.set_player_preference")
    @patch("core.utils.get_player_preference")
    def test_nickname_collision(
        self,
        mock_get_pref: MagicMock,
        mock_set_pref: MagicMock,
        mock_clear_pref: MagicMock,
    ):
        """Test that two members with the same nickname but different IDs are distinct."""
        role_dps = MagicMock()
        role_dps.name = "DPS"

        member1 = MagicMock()
        member1.id = 101
        member1.nick = "SameName"
        member1.roles = [MagicMock(), role_dps]

        member2 = MagicMock()
        member2.id = 102
        member2.nick = "SameName"
        member2.roles = [MagicMock(), role_dps]

        members = [member1, member2]

        # No saved roles
        mock_get_pref.return_value = None

        players = get_player_list(cast(list[discord.Member], members))

        self.assertEqual(len(players), 2)
        self.assertEqual(players[0].name, "SameName")
        self.assertEqual(players[1].name, "SameName")
        self.assertEqual(players[0].discord_id, "101")
        self.assertEqual(players[1].discord_id, "102")
        self.assertNotEqual(players[0], players[1])
        self.assertNotEqual(hash(players[0]), hash(players[1]))


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
