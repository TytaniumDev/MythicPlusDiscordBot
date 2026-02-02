import os
import unittest
import json
import sys

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from storage import (
    load_preferences,
    save_preferences,
    get_player_preference,
    set_player_preference,
    clear_player_preference,
    get_all_preferences,
    STORAGE_FILE
)

class TestStorage(unittest.TestCase):
    def setUp(self):
        # Backup existing storage file if it exists
        self.backup_exists = os.path.exists(STORAGE_FILE)
        if self.backup_exists:
            os.rename(STORAGE_FILE, STORAGE_FILE + ".bak")

    def tearDown(self):
        # Remove test storage file
        if os.path.exists(STORAGE_FILE):
            os.remove(STORAGE_FILE)
        # Restore backup
        if self.backup_exists:
            os.rename(STORAGE_FILE + ".bak", STORAGE_FILE)

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
