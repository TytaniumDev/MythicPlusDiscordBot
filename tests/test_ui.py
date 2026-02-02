import os
import unittest
import sys
import asyncio
from unittest.mock import MagicMock, AsyncMock

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from role_ui import RoleView, RoleButton
from config import ROLE_TANK, ROLE_HEALER
import discord

class TestUI(unittest.IsolatedAsyncioTestCase):
    async def test_role_view_initialization(self):
        initial_roles = [ROLE_TANK, "Brez"]
        # Mocking get_running_loop to avoid "no running event loop" error during View.__init__
        with unittest.mock.patch("asyncio.get_running_loop"):
            view = RoleView("TestPlayer", initial_roles)
            self.assertEqual(view.player_name, "TestPlayer")
            self.assertEqual(view.selected_roles, {ROLE_TANK, "Brez"})

            tank_button = next(item for item in view.children if isinstance(item, RoleButton) and item.role_name == ROLE_TANK)
            self.assertEqual(tank_button.style, discord.ButtonStyle.primary)

            healer_button = next(item for item in view.children if isinstance(item, RoleButton) and item.role_name == ROLE_HEALER)
            self.assertEqual(healer_button.style, discord.ButtonStyle.secondary)

    async def test_role_button_callback(self):
        with unittest.mock.patch("asyncio.get_running_loop"):
            view = RoleView("TestPlayer")
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

if __name__ == "__main__":
    unittest.main()
