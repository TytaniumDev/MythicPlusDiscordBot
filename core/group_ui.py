import discord
from discord.ext import commands

from core import config
from core.config import PLACEHOLDER_CHAR
from core.models import WoWGroup
from core.utils import get_masked_name, show_short_typing


def create_activity_message(invite_url: str, session_id: str | int) -> str:
    """
    Creates the formatted message for the activity command.

    Args:
        invite_url: The URL for the Discord activity invite.
        session_id: The session ID (usually guild ID) to append to the URL.

    Returns:
        The formatted message string.
    """
    activity_url_base = config.ACTIVITY_URL

    msg = "🎮 **Join the Activity!**\n"
    msg += f"**Voice Channel Activity:** {invite_url}\n"

    if activity_url_base:
        direct_link = f"{activity_url_base}?guildId={session_id}"
        msg += f"**Browser Link:** [Click Here]({direct_link})\n"
    else:
        msg += "⚠️ `ACTIVITY_URL` not set in .env."

    return msg


async def announce_group(
    ctx: commands.Context[commands.Bot],
    channel: discord.abc.GuildChannel | discord.abc.Messageable,
    group: WoWGroup,
    group_number: int,
    debug: bool,
) -> None:
    """
    Constructs and sends the group announcement embed with an animated reveal.

    Args:
        ctx: The command context.
        channel: The channel to send the announcement to.
        group: The WoWGroup object containing the players.
        group_number: The number of the group (e.g., Group 1, Group 2).
        debug: Whether to run in debug mode (skips animation delays).
    """
    # Print out the group in an embed to keep it tidy
    embed = discord.Embed(color=discord.Color.gold())
    embed.title = f"Group {group_number}"

    # Get player names or placeholders
    tank_name = group.tank.name if group.tank else PLACEHOLDER_CHAR
    healer_name = group.healer.name if group.healer else PLACEHOLDER_CHAR
    dps1_name = group.dps[0].name if len(group.dps) > 0 else PLACEHOLDER_CHAR
    dps2_name = group.dps[1].name if len(group.dps) > 1 else PLACEHOLDER_CHAR
    dps3_name = group.dps[2].name if len(group.dps) > 2 else PLACEHOLDER_CHAR

    # Find players with utilities
    brez_player = next(
        (p.name for p in [group.tank, group.healer] + group.dps if p and p.hasBrez),
        "None",
    )
    lust_player = next(
        (p.name for p in [group.tank, group.healer] + group.dps if p and p.hasLust),
        "None",
    )

    if debug:
        embed.add_field(name="Tank", value=f"{tank_name}").add_field(
            name="Healer", value=f"{healer_name}"
        ).add_field(
            name="DPS", value=f"{dps1_name}, {dps2_name}, {dps3_name}"
        ).add_field(name="Battle Res", value=f"{brez_player}", inline=True).add_field(
            name="Bloodlust", value=f"{lust_player}", inline=True
        )
        await ctx.send(embed=embed)
    else:
        embed.add_field(name="Tank", value=f"{get_masked_name(tank_name)}").add_field(
            name="Healer", value=f"{get_masked_name(healer_name)}"
        ).add_field(
            name="DPS",
            value=f"{get_masked_name(dps1_name)}, {get_masked_name(dps2_name)}, {get_masked_name(dps3_name)}",
        ).add_field(
            name="Battle Res",
            value=f"{get_masked_name(brez_player)}",
            inline=True,
        ).add_field(
            name="Bloodlust",
            value=f"{get_masked_name(lust_player)}",
            inline=True,
        )

        embedMessage = await ctx.send(embed=embed)
        await show_short_typing(channel, debug_mode=debug)
        embedMessage = await embedMessage.edit(
            embed=embed.set_field_at(index=0, name="Tank", value=f"{tank_name}")
        )
        await show_short_typing(channel, debug_mode=debug)
        embedMessage = await embedMessage.edit(
            embed=embed.set_field_at(index=1, name="Healer", value=f"{healer_name}")
        )
        await show_short_typing(channel, debug_mode=debug)
        embedMessage = await embedMessage.edit(
            embed=embed.set_field_at(
                index=2,
                name="DPS",
                value=f"{dps1_name}, {get_masked_name(dps2_name)}, {get_masked_name(dps3_name)}",
            )
        )
        await show_short_typing(channel, debug_mode=debug)
        embedMessage = await embedMessage.edit(
            embed=embed.set_field_at(
                index=2,
                name="DPS",
                value=f"{dps1_name}, {dps2_name}, {get_masked_name(dps3_name)}",
            )
        )
        await show_short_typing(channel, debug_mode=debug)
        embedMessage = await embedMessage.edit(
            embed=embed.set_field_at(
                index=2,
                name="DPS",
                value=f"{dps1_name}, {dps2_name}, {dps3_name}",
            )
        )
        embedMessage = await embedMessage.edit(
            embed=embed.set_field_at(index=3, name="Battle Res", value=f"{brez_player}")
        )
        await embedMessage.edit(
            embed=embed.set_field_at(index=4, name="Bloodlust", value=f"{lust_player}")
        )
