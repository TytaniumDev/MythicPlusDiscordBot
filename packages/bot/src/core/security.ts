import { obfuscatePii } from '@mythicplus/shared';
import * as config from './config.js';

export function sanitizeLogs(logs: string | null): string | null {
  if (!logs) return logs;

  if (config.BOT_TOKEN) {
    logs = logs.replaceAll(config.BOT_TOKEN, '[REDACTED_BOT_TOKEN]');
  }

  if (config.FIREBASE_CREDENTIALS_JSON) {
    logs = logs.replaceAll(config.FIREBASE_CREDENTIALS_JSON, '[REDACTED_FIREBASE_CREDENTIALS]');
  }

  if (config.GITHUB_TOKEN) {
    logs = logs.replaceAll(config.GITHUB_TOKEN, '[REDACTED_GITHUB_TOKEN]');
  }

  if (config.SENTRY_DSN) {
    logs = logs.replaceAll(config.SENTRY_DSN, '[REDACTED_SENTRY_DSN]');
  }

  if (config.DISCORD_APPLICATION_ID) {
    logs = logs.replaceAll(config.DISCORD_APPLICATION_ID, '[REDACTED_DISCORD_APPLICATION_ID]');
  }

  return logs;
}

export function sanitizeForGithub(text: string): string {
  const result = sanitizeLogs(text);
  if (result === null) return '';
  return obfuscatePii(result);
}
