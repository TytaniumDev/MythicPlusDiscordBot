import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import discord

from core.config import ROLE_HEALER, ROLE_HEALER_OFFSPEC, ROLE_TANK
from core.role_ui import (
    MainSpecView,
    OffspecView,
    PlayerRoleInfo,
    RoleBoardView,
    RoleButton,
    RoleSelectionState,
    UtilitiesView,
    create_role_board_embed,
    create_role_check_embed,
)


class TestUI(unittest.IsolatedAsyncioTestCase):
    def test_create_role_board_embed_description(self):
        # Create a dummy list of players (can be empty for this test)
        players = []
        embed = create_role_board_embed(players)

        self.assertEqual(embed.title, "Mythic+ Role Board")
        self.assertEqual(embed.description, "Current channel roster")
        self.assertEqual(embed.color, discord.Color.gold())

    def test_create_role_check_embed(self):
        player_infos = [
            PlayerRoleInfo(name="Player1", roles=["Tank", "Healer"]),
            PlayerRoleInfo(name="Player2", roles=["No roles set"]),
        ]

        embed = create_role_check_embed(player_infos)

        self.assertEqual(embed.title, "Saved Roles Check")
        self.assertEqual(embed.color, discord.Color.blue())
        self.assertEqual(len(embed.fields), 2)

        self.assertEqual(embed.fields[0].name, "Player1")
        self.assertEqual(embed.fields[0].value, "Tank, Healer")

        self.assertEqual(embed.fields[1].name, "Player2")
        self.assertEqual(embed.fields[1].value, "No roles set")

    async def test_main_spec_view_initialization(self):
        initial_roles = {ROLE_TANK, "Brez"}
        state = RoleSelectionState("TestPlayer", "12345", initial_roles)

        view = MainSpecView(state, "test")

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
        state = RoleSelectionState("TestPlayer", "12345", set())
        view = MainSpecView(state, "test")
        tank_button = next(
            item
            for item in view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_TANK
        )

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.edit_message = AsyncMock()

        await tank_button.callback(interaction)
        self.assertIn(ROLE_TANK, state.selected_roles)
        self.assertEqual(tank_button.style, discord.ButtonStyle.primary)

        await tank_button.callback(interaction)
        self.assertNotIn(ROLE_TANK, state.selected_roles)
        self.assertEqual(tank_button.style, discord.ButtonStyle.secondary)

    async def test_main_spec_mutual_exclusivity(self):
        state = RoleSelectionState("TestPlayer", "12345", set())
        view = MainSpecView(state, "test")

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.edit_message = AsyncMock()

        tank_button = next(
            item
            for item in view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_TANK
        )
        healer_button = next(
            item
            for item in view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_HEALER
        )

        await tank_button.callback(interaction)
        self.assertIn(ROLE_TANK, state.selected_roles)
        self.assertEqual(tank_button.style, discord.ButtonStyle.primary)

        # Selecting healer should deselect tank
        await healer_button.callback(interaction)
        self.assertIn(ROLE_HEALER, state.selected_roles)
        self.assertNotIn(ROLE_TANK, state.selected_roles)
        self.assertEqual(tank_button.style, discord.ButtonStyle.secondary)
        self.assertEqual(healer_button.style, discord.ButtonStyle.primary)

    async def test_shared_state_across_views(self):
        state = RoleSelectionState("TestPlayer", "12345", set())
        main_view = MainSpecView(state, "test_main")
        offspec_view = OffspecView(state, "test_off")

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.edit_message = AsyncMock()

        # Select tank in main spec
        tank_button = next(
            item
            for item in main_view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_TANK
        )
        await tank_button.callback(interaction)

        # Select healer offspec
        healer_off_button = next(
            item
            for item in offspec_view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_HEALER_OFFSPEC
        )
        await healer_off_button.callback(interaction)

        # Both should be in shared state
        self.assertIn(ROLE_TANK, state.selected_roles)
        self.assertIn(ROLE_HEALER_OFFSPEC, state.selected_roles)

    @patch("core.role_ui.get_preference_service")
    async def test_save_method(self, mock_get_svc: MagicMock):
        mock_svc = MagicMock()
        mock_svc.set_preference = AsyncMock()
        mock_get_svc.return_value = mock_svc

        state = RoleSelectionState("TestPlayer", "12345", {ROLE_TANK})
        main_view = MainSpecView(state, "test_main")
        offspec_view = OffspecView(state, "test_off")
        utilities_view = UtilitiesView(state, "test_util")
        state.views = [main_view, offspec_view, utilities_view]

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.send_message = AsyncMock()

        # Spy on stop for all views
        main_view.stop = MagicMock()
        offspec_view.stop = MagicMock()
        utilities_view.stop = MagicMock()

        await utilities_view.save.callback(interaction)

        mock_svc.set_preference.assert_called_once()
        args = mock_svc.set_preference.call_args
        self.assertEqual(args[0][0], "12345")
        self.assertEqual(args[0][1], "TestPlayer")
        self.assertIn(ROLE_TANK, args[0][2])

        interaction.response.send_message.assert_called_once()
        # All views should be stopped
        main_view.stop.assert_called_once()
        offspec_view.stop.assert_called_once()
        utilities_view.stop.assert_called_once()

    @patch("core.role_ui.get_preference_service")
    async def test_clear_method(self, mock_get_svc: MagicMock):
        mock_svc = MagicMock()
        mock_svc.clear_preference = AsyncMock()
        mock_get_svc.return_value = mock_svc

        state = RoleSelectionState("TestPlayer", "12345", {ROLE_TANK})
        main_view = MainSpecView(state, "test_main")
        offspec_view = OffspecView(state, "test_off")
        utilities_view = UtilitiesView(state, "test_util")
        state.views = [main_view, offspec_view, utilities_view]

        # Mock messages for the other views
        mock_msg1 = MagicMock()
        mock_msg1.edit = AsyncMock()
        mock_msg2 = MagicMock()
        mock_msg2.edit = AsyncMock()
        mock_msg3 = MagicMock()
        mock_msg3.edit = AsyncMock()
        state.messages = [mock_msg1, mock_msg2, mock_msg3]

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.edit_message = AsyncMock()
        interaction.followup = MagicMock()
        interaction.followup.send = AsyncMock()

        await utilities_view.clear.callback(interaction)

        mock_svc.clear_preference.assert_called_once_with("12345")
        self.assertEqual(len(state.selected_roles), 0)
        # Utilities message updated via interaction response
        interaction.response.edit_message.assert_called_once()
        # Other messages updated via stored references
        mock_msg1.edit.assert_called_once()
        mock_msg2.edit.assert_called_once()
        # Confirmation sent via followup
        interaction.followup.send.assert_called_once()

    async def test_role_board_view_initialization(self):
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
