import os
import sys
import unittest
from unittest.mock import MagicMock

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from core.utils import WoWName  # noqa: E402, I001


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

if __name__ == "__main__":
    unittest.main()
