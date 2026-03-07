import os
import sys
import unittest
from unittest.mock import AsyncMock, MagicMock, patch

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import discord

from core.config import (
    ROLE_HEALER,
    ROLE_HEALER_OFFSPEC,
    ROLE_TANK,
    ROLE_TANK_OFFSPEC,
)
from core.role_ui import (
    MainSpecView,
    NextButton,
    NoneButton,
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
    async def test_done_method(self, mock_get_svc: MagicMock):
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

        await utilities_view.done.callback(interaction)

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

    async def test_next_button(self):
        state = RoleSelectionState("TestPlayer", "12345", set())
        main_view = MainSpecView(state, "test_main")
        offspec_view = OffspecView(state, "test_off")
        utilities_view = UtilitiesView(state, "test_util")
        state.views = [main_view, offspec_view, utilities_view]
        state.step_contents = [
            "Select your roles for **TestPlayer**:\n**Main Spec** (pick one)",
            "**Offspec** (pick any)",
            "**Utilities**",
        ]
        state.messages = [MagicMock()]

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.edit_message = AsyncMock()
        mock_followup_msg = MagicMock()
        interaction.followup = MagicMock()
        interaction.followup.send = AsyncMock(return_value=mock_followup_msg)

        next_button = next(
            item for item in main_view.children if isinstance(item, NextButton)
        )

        await next_button.callback(interaction)

        # Button should be disabled
        self.assertTrue(next_button.disabled)
        # Current message should be edited
        interaction.response.edit_message.assert_called_once_with(view=main_view)
        # Next view should be sent via followup
        interaction.followup.send.assert_called_once_with(
            "**Offspec** (pick any)",
            view=offspec_view,
            ephemeral=True,
            wait=True,
        )
        # New message should be appended
        self.assertIn(mock_followup_msg, state.messages)

    async def test_none_button(self):
        state = RoleSelectionState(
            "TestPlayer",
            "12345",
            {ROLE_TANK_OFFSPEC, ROLE_HEALER_OFFSPEC},
        )
        offspec_view = OffspecView(state, "test_off")

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.edit_message = AsyncMock()

        none_button = next(
            item for item in offspec_view.children if isinstance(item, NoneButton)
        )

        await none_button.callback(interaction)

        # All offspec roles should be cleared
        self.assertNotIn(ROLE_TANK_OFFSPEC, state.selected_roles)
        self.assertNotIn(ROLE_HEALER_OFFSPEC, state.selected_roles)
        # None button highlighted
        self.assertEqual(none_button.style, discord.ButtonStyle.primary)
        # All role buttons reset
        for item in offspec_view.children:
            if isinstance(item, RoleButton):
                self.assertEqual(item.style, discord.ButtonStyle.secondary)

    async def test_role_button_deselects_none(self):
        state = RoleSelectionState("TestPlayer", "12345", set())
        offspec_view = OffspecView(state, "test_off")

        interaction = MagicMock(spec=discord.Interaction)
        interaction.response = MagicMock()
        interaction.response.edit_message = AsyncMock()

        none_button = next(
            item for item in offspec_view.children if isinstance(item, NoneButton)
        )
        # Simulate None being selected
        none_button.style = discord.ButtonStyle.primary

        # Click an offspec role
        tank_off_button = next(
            item
            for item in offspec_view.children
            if isinstance(item, RoleButton) and item.role_name == ROLE_TANK_OFFSPEC
        )
        await tank_off_button.callback(interaction)

        # None should be deselected
        self.assertEqual(none_button.style, discord.ButtonStyle.secondary)
        # Role should be selected
        self.assertIn(ROLE_TANK_OFFSPEC, state.selected_roles)

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
