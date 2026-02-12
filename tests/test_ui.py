import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import discord

from core.config import (
    ROLE_BREZ,
    ROLE_DPS,
    ROLE_HEALER,
    ROLE_LUST,
    ROLE_MELEE,
    ROLE_RANGED,
    ROLE_TANK,
)
from core.models import WoWPlayer
from core.role_ui import (
    RoleBoardView,
    RoleButton,
    RoleSelectionView,
    create_role_board_embed,
)


class TestUI(unittest.IsolatedAsyncioTestCase):
    def test_create_role_board_embed_description(self):
        # Create a dummy list of players (can be empty for this test)
        players = []
        embed = create_role_board_embed(players)

        self.assertEqual(embed.title, "Mythic+ Role Board")
        self.assertEqual(embed.description, "Current channel roster")
        self.assertEqual(embed.color, discord.Color.gold())

    def test_create_role_board_embed_with_players(self):
        # Create players with various roles
        tank = WoWPlayer.create("TankPlayer", [ROLE_TANK, ROLE_BREZ])
        healer = WoWPlayer.create("HealerPlayer", [ROLE_HEALER, ROLE_LUST])
        melee = WoWPlayer.create("MeleePlayer", [ROLE_DPS, ROLE_MELEE])
        ranged = WoWPlayer.create("RangedPlayer", [ROLE_DPS, ROLE_RANGED])
        # Generic DPS
        generic_dps = WoWPlayer.create("GenericDPS", [ROLE_DPS])

        players = [tank, healer, melee, ranged, generic_dps]

        embed = create_role_board_embed(players)

        # Helper to find field by name part
        def get_field_value(name_part: str) -> str | None:
            field = next(
                (f for f in embed.fields if f.name and name_part in f.name), None
            )
            return field.value if field else None

        # Assertions
        tank_val = get_field_value("Tank")
        self.assertIsNotNone(tank_val)
        # We checked isNotNone above, but pyright might still complain in assertIn if not cast,
        # however standard unittest.assertIsNotNone usually doesn't narrow types for pyright.
        assert tank_val is not None
        self.assertIn("TankPlayer", tank_val)
        self.assertIn("⚰️", tank_val)  # Has Brez

        healer_val = get_field_value("Healer")
        self.assertIsNotNone(healer_val)
        assert healer_val is not None
        self.assertIn("HealerPlayer", healer_val)
        self.assertIn("🎺", healer_val)  # Has Lust

        melee_val = get_field_value("Melee")
        self.assertIsNotNone(melee_val)
        assert melee_val is not None
        self.assertIn("MeleePlayer", melee_val)

        ranged_val = get_field_value("Ranged")
        self.assertIsNotNone(ranged_val)
        assert ranged_val is not None
        self.assertIn("RangedPlayer", ranged_val)

        dps_val = get_field_value("DPS")
        self.assertIsNotNone(dps_val)
        assert dps_val is not None
        self.assertIn("GenericDPS", dps_val)

        # Footer
        assert embed.footer.text is not None
        self.assertIn("1 Brez", embed.footer.text)
        self.assertIn("1 Lust", embed.footer.text)

    async def test_role_selection_view_initialization(self):
        initial_roles = [ROLE_TANK, "Brez"]

        view = RoleSelectionView("TestPlayer", initial_roles)
        self.assertEqual(view.player_name, "TestPlayer")
        self.assertEqual(view.selected_roles, {ROLE_TANK, "Brez"})

        tank_button = next(
            item
            for item in view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_TANK
        )
        self.assertEqual(tank_button.style, discord.ButtonStyle.primary)

        healer_button = next(
            item
            for item in view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_HEALER
        )
        self.assertEqual(healer_button.style, discord.ButtonStyle.secondary)

    async def test_role_button_callback(self):
        view = RoleSelectionView("TestPlayer")
        tank_button = next(
            item
            for item in view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_TANK
        )

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.edit_message = AsyncMock()

        await tank_button.callback(interaction)
        self.assertIn(ROLE_TANK, view.selected_roles)
        self.assertEqual(tank_button.style, discord.ButtonStyle.primary)

        await tank_button.callback(interaction)
        self.assertNotIn(ROLE_TANK, view.selected_roles)
        self.assertEqual(tank_button.style, discord.ButtonStyle.secondary)

    async def test_save_method(self):
        with patch("core.role_ui.set_player_preference") as mock_set_pref:
            view = RoleSelectionView("TestPlayer", [ROLE_TANK])
            interaction = MagicMock(spec=discord.Interaction)
            interaction.response = MagicMock()
            interaction.response.send_message = AsyncMock()
            view.stop = MagicMock()

            # Use callback similar to benchmark
            await view.save.callback(interaction)

            mock_set_pref.assert_called_once()
            args, _ = mock_set_pref.call_args
            self.assertEqual(args[0], "TestPlayer")
            self.assertIn(ROLE_TANK, args[1])

            interaction.response.send_message.assert_called_once()
            view.stop.assert_called_once()

    async def test_clear_method(self):
        with patch("core.role_ui.clear_player_preference") as mock_clear_pref:
            view = RoleSelectionView("TestPlayer", [ROLE_TANK])
            interaction = MagicMock(spec=discord.Interaction)
            interaction.response = MagicMock()
            interaction.response.send_message = AsyncMock()
            interaction.edit_original_response = AsyncMock()

            await view.clear.callback(interaction)

            mock_clear_pref.assert_called_once_with("TestPlayer")
            self.assertEqual(len(view.selected_roles), 0)
            interaction.response.send_message.assert_called_once()
            interaction.edit_original_response.assert_called_once()

    async def test_role_board_view_initialization(self):
        # We don't need to patch loop for IsolatedAsyncioTestCase usually if we use the right View init or if View uses get_running_loop
        # However, View uses get_running_loop(). IsolatedAsyncioTestCase provides one.
        mock_callback = AsyncMock()
        view = RoleBoardView(update_callback=mock_callback)

        # Check if button exists
        edit_button = next(
            (
                item
                for item in view.children
                if isinstance(item, discord.ui.Button)
                and item.custom_id == "edit_roles_button"
            ),
            None,
        )
        self.assertIsNotNone(edit_button)


if __name__ == "__main__":
    unittest.main()
