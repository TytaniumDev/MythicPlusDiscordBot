import json
import os
import sys
import unittest

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from unittest.mock import MagicMock, mock_open, patch

import core.storage as storage
from core.storage import (
    STORAGE_FILE,
    clear_player_preference,
    get_all_preferences,
    get_player_preference,
    load_preferences,
    save_preferences,
    set_player_preference,
)


class TestStorage(unittest.TestCase):
    def setUp(self):
        # Backup existing storage file if it exists
        self.backup_exists = os.path.exists(STORAGE_FILE)
        if self.backup_exists:
            os.rename(STORAGE_FILE, STORAGE_FILE + ".bak")
        # Reset cache (accessing private cache is necessary for test isolation)
        storage._preferences_cache = None  # pyright: ignore[reportPrivateUsage]

    def tearDown(self):
        # Remove test storage file
        if os.path.exists(STORAGE_FILE):
            os.remove(STORAGE_FILE)
        # Restore backup
        if self.backup_exists:
            os.rename(STORAGE_FILE + ".bak", STORAGE_FILE)
        # Reset cache (accessing private cache is necessary for test isolation)
        storage._preferences_cache = None  # pyright: ignore[reportPrivateUsage]

    def test_caching_behavior(self):
        # Setup initial file
        initial_data = {"Player1": ["Tank"]}
        with open(STORAGE_FILE, "w") as f:
            json.dump(initial_data, f)

        def is_read_call(c: tuple[tuple[object, ...], dict[str, object]]) -> bool:
            args = c[0]
            kwargs = c[1] if len(c) > 1 else {}
            if args[0] != STORAGE_FILE:
                return False
            mode = args[1] if len(args) > 1 else kwargs.get("mode", "r")
            return mode == "r"

        with patch("builtins.open", wraps=open) as mock_file:
            # First load
            data1 = load_preferences()
            self.assertEqual(data1, initial_data)

            # Verify read called (open with no mode or mode 'r')
            read_calls_1 = [c for c in mock_file.call_args_list if is_read_call(c)]
            self.assertEqual(len(read_calls_1), 1)

            # Second load - should use cache
            data2 = load_preferences()
            self.assertEqual(data2, initial_data)

            # Verify read NOT called again
            read_calls_2 = [c for c in mock_file.call_args_list if is_read_call(c)]
            self.assertEqual(len(read_calls_2), 1)

    def test_save_and_load(self):
        prefs = {"Player1": ["Tank", "Melee"]}
        save_preferences(prefs)
        loaded = load_preferences()
        self.assertEqual(prefs, loaded)

    def test_get_and_set_preference(self):
        set_player_preference("Player2", ["Healer"])
        self.assertEqual(get_player_preference("Player2"), ["Healer"])
        self.assertIsNone(get_player_preference("NonExistent"))

    def test_clear_preference(self):
        set_player_preference("Player3", ["Melee"])
        self.assertTrue(clear_player_preference("Player3"))
        self.assertIsNone(get_player_preference("Player3"))
        self.assertFalse(clear_player_preference("Player3"))

    def test_get_all_preferences(self):
        set_player_preference("P1", ["Role1"])
        set_player_preference("P2", ["Role2"])
        all_prefs = get_all_preferences()
        self.assertEqual(len(all_prefs), 2)
        self.assertIn("P1", all_prefs)
        self.assertIn("P2", all_prefs)

    @patch("os.path.exists", return_value=True)
    def test_load_corrupt_file(self, mock_exists: MagicMock):
        """Test that loading a corrupt JSON file returns empty dict and logs error."""
        # Ensure cache is cleared so it actually reads the file
        storage._preferences_cache = None  # pyright: ignore[reportPrivateUsage]

        with patch("builtins.open", mock_open(read_data="{invalid json")):
            with self.assertLogs("core.storage", level="ERROR") as cm:
                prefs = load_preferences()
                self.assertEqual(prefs, {})
                self.assertTrue(
                    any("Error loading preferences" in o for o in cm.output)
                )

    def test_save_error(self):
        """Test that saving error is logged and caught."""
        prefs = {"Test": ["Role"]}

        # Patch open to raise PermissionError
        with patch("builtins.open", side_effect=PermissionError("Mock perm error")):
            with self.assertLogs("core.storage", level="ERROR") as cm:
                save_preferences(prefs)
                self.assertTrue(any("Error saving preferences" in o for o in cm.output))


if __name__ == "__main__":
    unittest.main()
