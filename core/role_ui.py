from __future__ import annotations

import os
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from typing import Any

import discord

from .config import (
    ROLE_BREZ,
    ROLE_HEALER,
    ROLE_HEALER_OFFSPEC,
    ROLE_LUST,
    ROLE_MELEE,
    ROLE_MELEE_OFFSPEC,
    ROLE_RANGED,
    ROLE_RANGED_OFFSPEC,
    ROLE_TANK,
    ROLE_TANK_OFFSPEC,
)
from .models import WoWPlayer
from .preference_service import get_preference_service
from .utils import get_wow_name


@dataclass
class PlayerRoleInfo:
    """Data transfer object for role check display."""

    name: str
    roles: list[str]


@dataclass
class RoleSelectionState:
    """Shared mutable state across the 3 role selection views."""

    player_name: str
    discord_id: str
    selected_roles: set[str]
    on_save_callback: (
        Callable[[discord.Interaction], Coroutine[Any, Any, None]] | None
    ) = None
    views: list[discord.ui.View] = field(default_factory=list)
    messages: list[Any] = field(default_factory=list)


class RoleButton(discord.ui.Button[discord.ui.View]):
    def __init__(
        self,
        role_name: str,
        label: str,
        state: RoleSelectionState,
        style: discord.ButtonStyle = discord.ButtonStyle.secondary,
        custom_id_prefix: str = "",
        *,
        row: int | None = None,
        is_main_spec: bool = False,
    ):
        custom_id = f"{custom_id_prefix}:{role_name}" if custom_id_prefix else role_name
        super().__init__(label=label, style=style, custom_id=custom_id, row=row)
        self.role_name = role_name
        self.state = state
        self.is_main_spec = is_main_spec

    async def callback(self, interaction: discord.Interaction):
        view = self.view
        if view is None:
            return

        if self.role_name in self.state.selected_roles:
            self.state.selected_roles.remove(self.role_name)
            self.style = discord.ButtonStyle.secondary
        else:
            # Main spec: mutual exclusivity — deselect other main specs
            if self.is_main_spec:
                for item in view.children:
                    if (
                        isinstance(item, RoleButton)
                        and item.role_name != self.role_name
                    ):
                        self.state.selected_roles.discard(item.role_name)
                        item.style = discord.ButtonStyle.secondary
            self.state.selected_roles.add(self.role_name)
            self.style = discord.ButtonStyle.primary

        await interaction.response.edit_message(view=view)


class MainSpecView(discord.ui.View):
    def __init__(self, state: RoleSelectionState, prefix: str):
        super().__init__(timeout=60)
        self.state = state
        for role_id, label in [
            (ROLE_TANK, "🛡️ Tank"),
            (ROLE_HEALER, "🌿 Healer"),
            (ROLE_RANGED, "🏹 Ranged"),
            (ROLE_MELEE, "🪓 Melee"),
        ]:
            style = (
                discord.ButtonStyle.primary
                if role_id in state.selected_roles
                else discord.ButtonStyle.secondary
            )
            self.add_item(
                RoleButton(
                    role_id,
                    label,
                    state,
                    style,
                    custom_id_prefix=prefix,
                    row=0,
                    is_main_spec=True,
                )
            )


class OffspecView(discord.ui.View):
    def __init__(self, state: RoleSelectionState, prefix: str):
        super().__init__(timeout=60)
        self.state = state
        for role_id, label in [
            (ROLE_TANK_OFFSPEC, "🛡️ Tank"),
            (ROLE_HEALER_OFFSPEC, "🌿 Healer"),
            (ROLE_RANGED_OFFSPEC, "🏹 Ranged"),
            (ROLE_MELEE_OFFSPEC, "🪓 Melee"),
        ]:
            style = (
                discord.ButtonStyle.primary
                if role_id in state.selected_roles
                else discord.ButtonStyle.secondary
            )
            self.add_item(
                RoleButton(
                    role_id,
                    label,
                    state,
                    style,
                    custom_id_prefix=prefix,
                    row=0,
                )
            )


class UtilitiesView(discord.ui.View):
    def __init__(self, state: RoleSelectionState, prefix: str):
        super().__init__(timeout=60)
        self.state = state
        for role_id, label in [
            (ROLE_BREZ, "⚰️ Brez"),
            (ROLE_LUST, "🎺 Lust"),
        ]:
            style = (
                discord.ButtonStyle.primary
                if role_id in state.selected_roles
                else discord.ButtonStyle.secondary
            )
            self.add_item(
                RoleButton(
                    role_id,
                    label,
                    state,
                    style,
                    custom_id_prefix=prefix,
                    row=0,
                )
            )

    @discord.ui.button(label="Save", style=discord.ButtonStyle.success, row=1)
    async def save(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button[UtilitiesView],
    ):
        pref_svc = get_preference_service()
        await pref_svc.set_preference(
            self.state.discord_id,
            self.state.player_name,
            sorted(self.state.selected_roles),
        )
        await interaction.response.send_message(
            f"✅ Saved roles for **{self.state.player_name}**: "
            f"{', '.join(sorted(self.state.selected_roles)) if self.state.selected_roles else 'None'}",
            ephemeral=True,
        )

        if self.state.on_save_callback:
            await self.state.on_save_callback(interaction)

        for view in self.state.views:
            view.stop()

    @discord.ui.button(label="Clear", style=discord.ButtonStyle.danger, row=1)
    async def clear(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button[UtilitiesView],
    ):
        pref_svc = get_preference_service()
        await pref_svc.clear_preference(self.state.discord_id)
        self.state.selected_roles.clear()

        # Reset button styles across all views
        for view in self.state.views:
            for item in view.children:
                if isinstance(item, RoleButton):
                    item.style = discord.ButtonStyle.secondary

        # Update utilities message via interaction response
        await interaction.response.edit_message(view=self)

        # Update main spec and offspec messages
        for view, msg in zip(self.state.views, self.state.messages, strict=False):
            if view is not self and msg is not None:
                await msg.edit(view=view)

        await interaction.followup.send(
            f"🗑️ Cleared roles for **{self.state.player_name}**", ephemeral=True
        )

        if self.state.on_save_callback:
            await self.state.on_save_callback(interaction)


class RoleBoardView(discord.ui.View):
    def __init__(
        self,
        update_callback: Callable[
            [discord.Interaction, discord.Message],
            Coroutine[Any, Any, None],
        ],
    ):
        super().__init__(timeout=None)  # Persistent view
        self.update_callback = update_callback

    @discord.ui.button(
        label="Edit My Roles",
        style=discord.ButtonStyle.primary,
        custom_id="edit_roles_button",
    )
    async def edit_roles(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button[RoleBoardView],
    ):
        member = interaction.user
        name = get_wow_name(member)
        discord_id = str(member.id)

        pref_svc = get_preference_service()
        saved_roles = pref_svc.get_preference_sync(discord_id)
        if not saved_roles:
            saved_roles = pref_svc.get_preference_by_name_sync(name)
        board_message = interaction.message
        if board_message is None:
            return

        async def on_save(
            save_interaction: discord.Interaction,
        ) -> None:
            await self.update_callback(save_interaction, board_message)

        state = RoleSelectionState(name, discord_id, set(saved_roles or []), on_save)
        prefix = os.urandom(8).hex()

        main_view = MainSpecView(state, f"{prefix}_main")
        offspec_view = OffspecView(state, f"{prefix}_off")
        utilities_view = UtilitiesView(state, f"{prefix}_util")
        state.views = [main_view, offspec_view, utilities_view]

        await interaction.response.defer(ephemeral=True)

        msg1 = await interaction.followup.send(
            f"Select your roles for **{name}**:\n**Main Spec** (pick one)",
            view=main_view,
            ephemeral=True,
            wait=True,
        )
        msg2 = await interaction.followup.send(
            "**Offspec** (pick any)",
            view=offspec_view,
            ephemeral=True,
            wait=True,
        )
        msg3 = await interaction.followup.send(
            "**Utilities**",
            view=utilities_view,
            ephemeral=True,
            wait=True,
        )
        state.messages = [msg1, msg2, msg3]


def create_role_board_embed(players: list[WoWPlayer]) -> discord.Embed:
    embed = discord.Embed(
        title="Mythic+ Role Board",
        description="Current channel roster",
        color=discord.Color.gold(),
    )

    def format_player(p: WoWPlayer) -> str:
        icons = ""
        if p.hasBrez:
            icons += "⚰️"
        if p.hasLust:
            icons += "🎺"
        return f"{p.name} {icons}".strip()

    tanks = [format_player(p) for p in players if p.tankMain]
    healers = [format_player(p) for p in players if p.healerMain]
    melee = [format_player(p) for p in players if p.melee]
    ranged = [format_player(p) for p in players if p.ranged]

    def format_list(names: list[str]) -> str:
        return "\n".join(names) if names else "-"

    embed.add_field(
        name=f"🛡️ Tank ({len(tanks)})", value=format_list(tanks), inline=True
    )
    embed.add_field(
        name=f"🌿 Healer ({len(healers)})", value=format_list(healers), inline=True
    )
    embed.add_field(name="\u200b", value="\u200b", inline=True)  # Spacer row 1

    embed.add_field(
        name=f"🪓 Melee ({len(melee)})", value=format_list(melee), inline=True
    )
    embed.add_field(
        name=f"🏹 Ranged ({len(ranged)})", value=format_list(ranged), inline=True
    )
    embed.add_field(name="\u200b", value="\u200b", inline=True)  # Spacer row 2

    unassigned = [format_player(p) for p in players if not p.hasRoles()]
    if unassigned:
        embed.add_field(
            name=f"Unassigned ({len(unassigned)})",
            value=format_list(unassigned),
            inline=True,
        )

    # Calculate utility counts
    brez_count = sum(1 for p in players if p.hasBrez)
    lust_count = sum(1 for p in players if p.hasLust)

    embed.set_footer(text=f"Utilities: {brez_count} Brez, {lust_count} Lust")

    return embed


def create_role_check_embed(player_infos: list[PlayerRoleInfo]) -> discord.Embed:
    """
    Creates an embed listing players and their roles.

    Args:
        player_infos: List of PlayerRoleInfo objects containing player data.

    Returns:
        A discord.Embed object populated with fields for each player.
    """
    embed = discord.Embed(title="Saved Roles Check", color=discord.Color.blue())

    for info in player_infos:
        embed.add_field(name=info.name, value=", ".join(info.roles), inline=False)

    return embed
