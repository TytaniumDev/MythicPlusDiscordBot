import 'dotenv/config';

// Re-export shared role constants
export {
  ROLE_TANK,
  ROLE_HEALER,
  ROLE_RANGED,
  ROLE_MELEE,
  ROLE_TANK_OFFSPEC,
  ROLE_HEALER_OFFSPEC,
  ROLE_RANGED_OFFSPEC,
  ROLE_MELEE_OFFSPEC,
  ROLE_BREZ,
  ROLE_LUST,
  ALL_ROLES,
} from '@mythicplus/shared';

// Bot-specific environment variables
export const BOT_TOKEN = process.env.BOT_TOKEN ?? undefined;
export const DISCORD_APPLICATION_ID = process.env.DISCORD_APPLICATION_ID ?? undefined;
export const DEVELOPER_ID = parseInt(process.env.DEVELOPER_ID ?? '202184987469021184', 10);
export const BOT_INVITE_PERMISSIONS = parseInt(
  process.env.BOT_INVITE_PERMISSIONS ?? '3263489',
  10,
);

// GitHub Issue Integration
const rawGithubToken = process.env.GITHUB_TOKEN;
export const GITHUB_TOKEN = rawGithubToken?.trim() || undefined;
export const GITHUB_REPO_OWNER = (process.env.GITHUB_REPO_OWNER ?? 'TytaniumDev').trim();
export const GITHUB_REPO_NAME = (
  process.env.GITHUB_REPO_NAME ?? 'MythicPlusDiscordBot'
).trim();

// Container version (commit SHA baked in at build time)
export const GIT_SHA = process.env.GIT_SHA?.trim() || undefined;

// Activity Link
export const ACTIVITY_URL = (
  process.env.ACTIVITY_URL ?? 'https://tytaniumdev.github.io/MythicPlusDiscordBot/'
).trim();

// Assets
export const PLACEHOLDER_CHAR = ':question:';

// Logging
export const LOG_FILE = 'mythic_bot.log';

// Firebase Credentials (JSON)
export const FIREBASE_CREDENTIALS_JSON =
  process.env.FIREBASE_CREDENTIALS_JSON ?? undefined;
