import discord
import os
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN")

intents = discord.Intents.all()
intents.message_content = True


client = discord.Client(intents=intents)
bot = commands.Bot(command_prefix="!", intents=intents)

def WoWName(member):
    return member.nick if member.nick != None else member.global_name

@bot.command()
async def wheel(ctx):
    tanks = []
    healers = []
    dps = []
    members = [member for member in ctx.channel.members if member.bot == False]
    WoWNames = [member.nick if member.nick != None else member.global_name for member in members]
    for member in members:
        for role in member.roles:
            match role.name:
                case "Tank":
                    tanks.append(WoWName(member))
                case "Healer":
                    healers.append(WoWName(member))
                case "Ranged":
                    dps.append(WoWName(member))
                case "Melee":
                    dps.append(WoWName(member))
                case "DPS":
                    dps.append(WoWName(member))
    

    print(f'In {ctx.channel} the members are {members}')
    print(f'Member roles are {[member.roles for member in members]}')
    embed = discord.Embed()
    embed.title = "Picker Wheel Link"
    embed.description = f"Tanks: {','.join(tanks)}\nHealers: {','.join(healers)}\nDPS: {','.join(dps)}"
    embed.url = f"https://pickerwheel.com/?choices={','.join(WoWNames)}"
    await ctx.send(embed = embed)

bot.run(BOT_TOKEN)
