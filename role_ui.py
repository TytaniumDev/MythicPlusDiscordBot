import discord
from storage import set_player_preference, get_player_preference, clear_player_preference
from config import (
    ROLE_TANK, ROLE_HEALER, ROLE_DPS, ROLE_RANGED, ROLE_MELEE,
    ROLE_TANK_OFFSPEC, ROLE_HEALER_OFFSPEC, ROLE_DPS_OFFSPEC,
    ROLE_BREZ, ROLE_LUST
)

class RoleButton(discord.ui.Button):
    def __init__(self, role_name, label, style=discord.ButtonStyle.secondary):
        super().__init__(label=label, style=style, custom_id=role_name)
        self.role_name = role_name

    async def callback(self, interaction: discord.Interaction):
        view: RoleView = self.view
        if self.role_name in view.selected_roles:
            view.selected_roles.remove(self.role_name)
            self.style = discord.ButtonStyle.secondary
        else:
            view.selected_roles.add(self.role_name)
            self.style = discord.ButtonStyle.primary

        await interaction.response.edit_message(view=view)

class RoleView(discord.ui.View):
    def __init__(self, player_name, initial_roles=None):
        super().__init__(timeout=60)
        self.player_name = player_name
        self.selected_roles = set(initial_roles or [])

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
            style = discord.ButtonStyle.primary if role_id in self.selected_roles else discord.ButtonStyle.secondary
            self.add_item(RoleButton(role_id, label, style))

    @discord.ui.button(label="Save", style=discord.ButtonStyle.success, row=2)
    async def save(self, interaction: discord.Interaction, button: discord.ui.Button):
        set_player_preference(self.player_name, list(self.selected_roles))
        await interaction.response.send_message(f"✅ Saved roles for **{self.player_name}**: {', '.join(self.selected_roles) if self.selected_roles else 'None'}", ephemeral=True)
        self.stop()

    @discord.ui.button(label="Clear", style=discord.ButtonStyle.danger, row=2)
    async def clear(self, interaction: discord.Interaction, button: discord.ui.Button):
        clear_player_preference(self.player_name)
        self.selected_roles.clear()
        for item in self.children:
            if isinstance(item, RoleButton):
                item.style = discord.ButtonStyle.secondary
        await interaction.response.send_message(f"🗑️ Cleared roles for **{self.player_name}**", ephemeral=True)
        await interaction.edit_original_response(view=self)
