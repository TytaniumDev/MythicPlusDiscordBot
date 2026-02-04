import os
import unittest
import json
import sys

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import core.storage as storage
from core.storage import (
    load_preferences,
    save_preferences,
    get_player_preference,
    set_player_preference,
    clear_player_preference,
    get_all_preferences,
    STORAGE_FILE
)
from unittest.mock import patch

class TestStorage(unittest.TestCase):
    def setUp(self):
        # Backup existing storage file if it exists
        self.backup_exists = os.path.exists(STORAGE_FILE)
        if self.backup_exists:
            os.rename(STORAGE_FILE, STORAGE_FILE + ".bak")
        # Reset cache
        storage._PREFERENCES_CACHE = None

    def tearDown(self):
        # Remove test storage file
        if os.path.exists(STORAGE_FILE):
            os.remove(STORAGE_FILE)
        # Restore backup
        if self.backup_exists:
            os.rename(STORAGE_FILE + ".bak", STORAGE_FILE)
        # Reset cache
        storage._PREFERENCES_CACHE = None

    def test_caching_behavior(self):
        # Setup initial file
        initial_data = {"Player1": ["Tank"]}
        with open(STORAGE_FILE, "w") as f:
            json.dump(initial_data, f)

        with patch("builtins.open", wraps=open) as mock_file:
            # First load
            data1 = load_preferences()
            self.assertEqual(data1, initial_data)

            # Verify read called
            read_calls_1 = [c for c in mock_file.call_args_list if c[0][0] == STORAGE_FILE and 'r' in c[0]]
            self.assertEqual(len(read_calls_1), 1)

            # Second load - should use cache
            data2 = load_preferences()
            self.assertEqual(data2, initial_data)

            # Verify read NOT called again
            read_calls_2 = [c for c in mock_file.call_args_list if c[0][0] == STORAGE_FILE and 'r' in c[0]]
            self.assertEqual(len(read_calls_2), 1)

    def test_save_and_load(self):
        prefs = {"Player1": ["Tank", "DPS"]}
        save_preferences(prefs)
        loaded = load_preferences()
        self.assertEqual(prefs, loaded)

    def test_get_and_set_preference(self):
        set_player_preference("Player2", ["Healer"])
        self.assertEqual(get_player_preference("Player2"), ["Healer"])
        self.assertIsNone(get_player_preference("NonExistent"))

    def test_clear_preference(self):
        set_player_preference("Player3", ["DPS"])
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

if __name__ == "__main__":
    unittest.main()
