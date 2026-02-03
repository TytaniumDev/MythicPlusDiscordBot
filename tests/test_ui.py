import os
import unittest
import sys
import asyncio
from unittest.mock import MagicMock, AsyncMock

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from role_ui import RoleSelectionView, RoleButton, RoleBoardView, create_role_board_embed
from config import ROLE_TANK, ROLE_HEALER
from models import WoWPlayer
import discord

class TestUI(unittest.IsolatedAsyncioTestCase):
    def test_create_role_board_embed_description(self):
        # Create a dummy list of players (can be empty for this test)
        players = []
        embed = create_role_board_embed(players)

        self.assertEqual(embed.title, "Mythic+ Role Board")
        self.assertEqual(embed.description, "Current channel roster")
        self.assertEqual(embed.color, discord.Color.gold())
    async def test_role_selection_view_initialization(self):
        initial_roles = [ROLE_TANK, "Brez"]
        # Mocking get_running_loop to avoid "no running event loop" error during View.__init__
        with unittest.mock.patch("asyncio.get_running_loop"):
            view = RoleSelectionView("TestPlayer", initial_roles)
            self.assertEqual(view.player_name, "TestPlayer")
            self.assertEqual(view.selected_roles, {ROLE_TANK, "Brez"})

            tank_button = next(item for item in view.children if isinstance(item, RoleButton) and item.role_name == ROLE_TANK)
            self.assertEqual(tank_button.style, discord.ButtonStyle.primary)

            healer_button = next(item for item in view.children if isinstance(item, RoleButton) and item.role_name == ROLE_HEALER)
            self.assertEqual(healer_button.style, discord.ButtonStyle.secondary)

    async def test_role_button_callback(self):
        with unittest.mock.patch("asyncio.get_running_loop"):
            view = RoleSelectionView("TestPlayer")
            tank_button = next(item for item in view.children if isinstance(item, RoleButton) and item.role_name == ROLE_TANK)

            interaction = MagicMock(spec=discord.Interaction)
            interaction.response = MagicMock()
            interaction.response.edit_message = AsyncMock()

            await tank_button.callback(interaction)
            self.assertIn(ROLE_TANK, view.selected_roles)
            self.assertEqual(tank_button.style, discord.ButtonStyle.primary)

            await tank_button.callback(interaction)
            self.assertNotIn(ROLE_TANK, view.selected_roles)
            self.assertEqual(tank_button.style, discord.ButtonStyle.secondary)

    async def test_role_board_view_initialization(self):
         with unittest.mock.patch("asyncio.get_running_loop"):
            mock_callback = AsyncMock()
            view = RoleBoardView(update_callback=mock_callback)

            # Check if button exists
            edit_button = next((item for item in view.children if isinstance(item, discord.ui.Button) and item.custom_id == "edit_roles_button"), None)
            self.assertIsNotNone(edit_button)

if __name__ == "__main__":
    unittest.main()
