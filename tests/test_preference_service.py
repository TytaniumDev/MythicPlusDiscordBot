import os
import sys
import unittest
from unittest.mock import MagicMock, patch

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))


class TestPreferenceService(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        # Reset singleton
        import core.preference_service as mod

        mod._instance = None

    @patch("core.preference_service.FirebaseService")
    async def test_set_and_get_sync(self, mock_fb_cls: MagicMock):
        mock_fb = MagicMock()
        mock_fb.is_available.return_value = False
        mock_fb_cls.return_value = mock_fb

        from core.preference_service import PreferenceService

        svc = PreferenceService()

        with patch("core.preference_service.set_player_preference"):
            await svc.set_preference("123", "Martz", ["Tank", "Brez"])

        result = svc.get_preference_sync("123")
        self.assertEqual(result, ["Tank", "Brez"])

    @patch("core.preference_service.FirebaseService")
    async def test_get_by_name_sync(self, mock_fb_cls: MagicMock):
        mock_fb = MagicMock()
        mock_fb.is_available.return_value = False
        mock_fb_cls.return_value = mock_fb

        from core.preference_service import PreferenceService

        svc = PreferenceService()

        with patch("core.preference_service.set_player_preference"):
            await svc.set_preference("123", "Martz", ["Healer"])

        result = svc.get_preference_by_name_sync("Martz")
        self.assertEqual(result, ["Healer"])

    @patch("core.preference_service.FirebaseService")
    async def test_clear_preference(self, mock_fb_cls: MagicMock):
        mock_fb = MagicMock()
        mock_fb.is_available.return_value = False
        mock_fb_cls.return_value = mock_fb

        from core.preference_service import PreferenceService

        svc = PreferenceService()

        with patch("core.preference_service.set_player_preference"):
            await svc.set_preference("123", "Martz", ["Tank"])

        with patch("core.preference_service.clear_player_preference"):
            await svc.clear_preference("123")

        self.assertIsNone(svc.get_preference_sync("123"))
        self.assertIsNone(svc.get_preference_by_name_sync("Martz"))

    @patch("core.preference_service.FirebaseService")
    @patch("core.preference_service.get_all_preferences")
    async def test_load_cache_fallback_to_local(
        self, mock_get_all: MagicMock, mock_fb_cls: MagicMock
    ):
        mock_fb = MagicMock()
        mock_fb.is_available.return_value = False
        mock_fb_cls.return_value = mock_fb

        mock_get_all.return_value = {"Martz": ["Tank"], "Tytanium": ["Ranged"]}

        from core.preference_service import PreferenceService

        svc = PreferenceService()
        await svc.load_cache()

        self.assertEqual(svc.get_preference_by_name_sync("Martz"), ["Tank"])
        self.assertEqual(svc.get_preference_by_name_sync("Tytanium"), ["Ranged"])


if __name__ == "__main__":
    unittest.main()
