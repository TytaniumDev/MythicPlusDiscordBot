import os

from dotenv import load_dotenv

load_dotenv()

# Discord Roles
ROLE_TANK = os.getenv("ROLE_TANK", "Tank")
ROLE_HEALER = os.getenv("ROLE_HEALER", "Healer")
ROLE_DPS = os.getenv("ROLE_DPS", "DPS")
ROLE_RANGED = os.getenv("ROLE_RANGED", "Ranged")
ROLE_MELEE = os.getenv("ROLE_MELEE", "Melee")
ROLE_TANK_OFFSPEC = os.getenv("ROLE_TANK_OFFSPEC", "Tank Offspec")
ROLE_HEALER_OFFSPEC = os.getenv("ROLE_HEALER_OFFSPEC", "Healer Offspec")
ROLE_DPS_OFFSPEC = os.getenv("ROLE_DPS_OFFSPEC", "DPS Offspec")
ROLE_BREZ = os.getenv("ROLE_BREZ", "Brez")
ROLE_LUST = os.getenv("ROLE_LUST", "Lust")

# All recognized roles for validation/parsing
ALL_ROLES = [
    ROLE_TANK,
    ROLE_HEALER,
    ROLE_DPS,
    ROLE_RANGED,
    ROLE_MELEE,
    ROLE_TANK_OFFSPEC,
    ROLE_HEALER_OFFSPEC,
    ROLE_DPS_OFFSPEC,
    ROLE_BREZ,
    ROLE_LUST,
]

# Bot invite URL permissions (integer from Discord Developer Portal → OAuth2 → URL Generator).
# Used when generating the "Add bot to server" link so the bot requests these permissions.
BOT_INVITE_PERMISSIONS = int(os.getenv("BOT_INVITE_PERMISSIONS", "3263489"))

# Assets
ASSETS_DIR = "assets"
SPIN_SOUND = os.path.join(ASSETS_DIR, "spin.ogg")
REVEAL_SOUND = os.path.join(ASSETS_DIR, "reveal.ogg")
WHEEL_GIF = os.path.join(ASSETS_DIR, "wheel.gif")

# Constants
PLACEHOLDER_CHAR = ':question:'

# GitHub Issue Integration
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_REPO_OWNER = os.getenv("GITHUB_REPO_OWNER", "TytaniumDev")
GITHUB_REPO_NAME = os.getenv("GITHUB_REPO_NAME", "MythicPlusDiscordBot")
