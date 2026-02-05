import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.utils import WoWName, getPlayerList  # noqa: E402, I001


class TestUtils(unittest.TestCase):
    def test_WoWName_priority(self):
        """Test that WoWName prioritizes Nick > Global > Str and removes dots."""
        # Case 1: Nickname exists
        member = MagicMock()
        member.nick = "Nick.Name"
        # global_name should be ignored if nick is present
        member.global_name = "Global.Name"
        self.assertEqual(WoWName(member), "NickName")

        # Case 2: No nick, global name exists
        member.nick = None
        member.global_name = "Global.Name"
        self.assertEqual(WoWName(member), "GlobalName")

        # Case 3: No nick, no global name, fallback to string representation
        member.nick = None
        member.global_name = None
        member.__str__.return_value = "User.Name"
        self.assertEqual(WoWName(member), "UserName")

    @patch("core.utils.get_player_preference")
    def test_getPlayerList(self, mock_get_pref):
        """Test that getPlayerList correctly creates WoWPlayer objects from members."""
        # Setup members
        role_everyone = MagicMock()
        role_everyone.name = "@everyone"

        role_dps = MagicMock()
        role_dps.name = "DPS"

        member_saved = MagicMock()
        member_saved.nick = "SavedPlayer"
        member_saved.roles = [role_everyone]

        member_discord = MagicMock()
        member_discord.nick = "DiscordPlayer"
        member_discord.roles = [role_everyone, role_dps]

        member_invalid = MagicMock()
        member_invalid.nick = "InvalidPlayer"
        member_invalid.roles = [role_everyone]  # No saved roles, no extra discord roles

        members = [member_saved, member_discord, member_invalid]

        # Setup mock preferences
        def get_pref_side_effect(name):
            if name == "SavedPlayer":
                return ["Tank"]
            return None

        mock_get_pref.side_effect = get_pref_side_effect

        # Call function
        players = getPlayerList(members)

        # Assertions
        self.assertEqual(len(players), 2)

        # Verify SavedPlayer
        p1 = next((p for p in players if p.name == "SavedPlayer"), None)
        self.assertIsNotNone(p1)
        self.assertTrue(p1.tankMain)

        # Verify DiscordPlayer
        p2 = next((p for p in players if p.name == "DiscordPlayer"), None)
        self.assertIsNotNone(p2)
        self.assertTrue(p2.dpsMain)

        # Verify InvalidPlayer is skipped
        p3 = next((p for p in players if p.name == "InvalidPlayer"), None)
        self.assertIsNone(p3)


if __name__ == "__main__":
    unittest.main()
