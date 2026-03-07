from __future__ import annotations

import asyncio
import os
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from typing import Any

import discord

from .config import (
    ROLE_BREZ,
    ROLE_DPS,
    ROLE_DPS_OFFSPEC,
    ROLE_HEALER,
    ROLE_HEALER_OFFSPEC,
    ROLE_LUST,
    ROLE_MELEE,
    ROLE_RANGED,
    ROLE_TANK,
    ROLE_TANK_OFFSPEC,
)
from .models import WoWPlayer
from .storage import (
    clear_player_preference,
    get_player_preference,
    set_player_preference,
)
from .utils import get_wow_name


@dataclass
class PlayerRoleInfo:
    """Data transfer object for role check display."""

    name: str
    roles: list[str]


class RoleButton(discord.ui.Button["RoleSelectionView"]):
    def __init__(
        self,
        role_name: str,
        label: str,
        style: discord.ButtonStyle = discord.ButtonStyle.secondary,
        custom_id_prefix: str = "",
    ):
        custom_id = f"{custom_id_prefix}:{role_name}" if custom_id_prefix else role_name
        super().__init__(label=label, style=style, custom_id=custom_id)
        self.role_name = role_name

    async def callback(self, interaction: discord.Interaction):
        view = self.view
        if view is None:
            return
        assert isinstance(view, RoleSelectionView)
        if self.role_name in view.selected_roles:
            view.selected_roles.remove(self.role_name)
            self.style = discord.ButtonStyle.secondary
        else:
            view.selected_roles.add(self.role_name)
            self.style = discord.ButtonStyle.primary

        await interaction.response.edit_message(view=view)


class RoleSelectionView(discord.ui.View):
    def __init__(
        self,
        player_name: str,
        initial_roles: list[str] | None = None,
        on_save_callback: (
            Callable[[discord.Interaction], Coroutine[Any, Any, None]] | None
        ) = None,
    ):
        super().__init__(timeout=60)
        self.player_name = player_name
        self.selected_roles = set(initial_roles or [])
        self.on_save_callback = on_save_callback

        # Unique prefix prevents ViewStore dispatch collisions between concurrent users
        prefix = os.urandom(8).hex()

        roles = [
            (ROLE_TANK, "🛡️ Tank"),
            (ROLE_HEALER, "🌿 Healer"),
            (ROLE_DPS, "⚔️ DPS"),
            (ROLE_TANK_OFFSPEC, "🛡️ Tank Off"),
            (ROLE_HEALER_OFFSPEC, "🌿 Healer Off"),
            (ROLE_DPS_OFFSPEC, "⚔️ DPS Off"),
            (ROLE_RANGED, "🏹 Ranged"),
            (ROLE_MELEE, "🪓 Melee"),
            (ROLE_BREZ, "⚰️ Brez"),
            (ROLE_LUST, "🎺 Lust"),
        ]

        for role_id, label in roles:
            style = (
                discord.ButtonStyle.primary
                if role_id in self.selected_roles
                else discord.ButtonStyle.secondary
            )
            self.add_item(RoleButton(role_id, label, style, custom_id_prefix=prefix))

    @discord.ui.button(label="Save", style=discord.ButtonStyle.success, row=2)
    async def save(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button[RoleSelectionView],
    ):
        await asyncio.to_thread(
            set_player_preference, self.player_name, list(self.selected_roles)
        )
        await interaction.response.send_message(
            f"✅ Saved roles for **{self.player_name}**: {', '.join(self.selected_roles) if self.selected_roles else 'None'}",
            ephemeral=True,
        )

        if self.on_save_callback:
            await self.on_save_callback(interaction)

        self.stop()

    @discord.ui.button(label="Clear", style=discord.ButtonStyle.danger, row=2)
    async def clear(
        self,
        interaction: discord.Interaction,
        button: discord.ui.Button[RoleSelectionView],
    ):
        await asyncio.to_thread(clear_player_preference, self.player_name)
        self.selected_roles.clear()
        for item in self.children:
            if isinstance(item, RoleButton):
                item.style = discord.ButtonStyle.secondary
        await interaction.response.send_message(
            f"🗑️ Cleared roles for **{self.player_name}**", ephemeral=True
        )
        await interaction.edit_original_response(view=self)

        if self.on_save_callback:
            await self.on_save_callback(interaction)


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

        saved_roles = get_player_preference(name)
        board_message = interaction.message
        if board_message is None:
            return

        async def on_save(
            save_interaction: discord.Interaction,
        ) -> None:
            await self.update_callback(save_interaction, board_message)

        view = RoleSelectionView(name, (saved_roles or []), on_save_callback=on_save)
        await interaction.response.send_message(
            f"Select your roles for **{name}**:", view=view, ephemeral=True
        )


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

    # Generic DPS are those who are dpsMain but not specifically melee or ranged
    generic_dps = [
        format_player(p) for p in players if p.dpsMain and not p.melee and not p.ranged
    ]

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

    if generic_dps:
        embed.add_field(
            name=f"⚔️ DPS ({len(generic_dps)})",
            value=format_list(generic_dps),
            inline=True,
        )

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
