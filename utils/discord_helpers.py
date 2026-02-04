import discord
import asyncio
import os

def WoWName(member, debug: bool = None):
    if debug: print(f"WoWName - Member: {member}\nNick: {member.nick}\nGlobal: {member.global_name}")
    rawName =  member.nick if member.nick != None else member.global_name if member.global_name != None else str(member)
    return rawName.replace('.', '')

async def showLongTyping(channel, debug_mode: bool = False):
    # Skip sleeps in debug mode for faster testing
    if not debug_mode:
        async with channel.typing():
            await asyncio.sleep(2)

async def showShortTyping(channel, debug_mode: bool = False):
    # Skip sleeps in debug mode for faster testing
    if not debug_mode:
        async with channel.typing():
            await asyncio.sleep(1)

def dashed(name):
     return '?' * len(name)

async def join_voice_channel(ctx):
    """Joins the voice channel of the command author."""
    if ctx.author.voice:
        channel = ctx.author.voice.channel
        if ctx.voice_client:
            if ctx.voice_client.channel != channel:
                await ctx.voice_client.move_to(channel)
        else:
            await channel.connect()
        return ctx.voice_client
    return None

async def play_sound(voice_client, sound_path):
    """Plays a sound file in the given voice client."""
    if voice_client and os.path.exists(sound_path):
        try:
            if voice_client.is_playing():
                voice_client.stop()
            voice_client.play(discord.FFmpegPCMAudio(sound_path))
            # We don't necessarily want to wait for the whole sound if it's a loop
        except Exception as e:
            print(f"Error playing sound {sound_path}: {e}")
