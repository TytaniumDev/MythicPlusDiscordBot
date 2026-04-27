import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  BOT_TOKEN: z.string().optional(),
  DISCORD_APPLICATION_ID: z.string().optional(),
  DEVELOPER_ID: z.coerce.number().default(0),
  BOT_INVITE_PERMISSIONS: z.coerce.number().default(551903415361),
  GITHUB_TOKEN: z.string().trim().optional(),
  GITHUB_REPO_OWNER: z.string().trim().default('TytaniumDev'),
  GITHUB_REPO_NAME: z.string().trim().default('MythicPlusDiscordBot'),
  GIT_SHA: z.string().trim().optional(),
  SENTRY_DSN: z.string().trim().optional(),
  ACTIVITY_URL: z
    .string()
    .trim()
    .default('https://tytaniumdev.github.io/MythicPlusDiscordBot/'),
  FIREBASE_CREDENTIALS_JSON: z.string().optional(),
});

const env = envSchema.parse(process.env);

// Bot-specific environment variables
export const BOT_TOKEN = env.BOT_TOKEN;
export const DISCORD_APPLICATION_ID = env.DISCORD_APPLICATION_ID;
export const DEVELOPER_ID = env.DEVELOPER_ID;
export const BOT_INVITE_PERMISSIONS = env.BOT_INVITE_PERMISSIONS;

// GitHub Issue Integration
export const GITHUB_TOKEN = env.GITHUB_TOKEN;
export const GITHUB_REPO_OWNER = env.GITHUB_REPO_OWNER;
export const GITHUB_REPO_NAME = env.GITHUB_REPO_NAME;

// Container version (commit SHA baked in at build time)
export const GIT_SHA = env.GIT_SHA;

// Sentry error tracking
export const SENTRY_DSN = env.SENTRY_DSN;

// Activity Link
export const ACTIVITY_URL = env.ACTIVITY_URL;

// Firebase Credentials (JSON)
export const FIREBASE_CREDENTIALS_JSON = env.FIREBASE_CREDENTIALS_JSON;

// Assets
export const PLACEHOLDER_CHAR = ':question:';

// Logging
export const LOG_FILE = 'mythic_bot.log';
