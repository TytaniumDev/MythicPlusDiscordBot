import * as config from './config.js';

export function obfuscatePii(text: string): string {
  if (!text) return text;

  // 1. Discord object repr: <Member id=123… name='Foo' …>
  text = text.replace(
    /<(\w+)\s+id=\d{15,21}\s+name='.*?'/g,
    "<$1 id=[REDACTED_ID] name='[REDACTED]'",
  );

  // 2. "User: Name (ID)" context lines
  text = text.replace(
    /(User:\s*).+\s\(\d{15,21}\)/g,
    '$1[REDACTED_USER] ([REDACTED_ID])',
  );

  // 3. Username#Discriminator (legacy format)
  text = text.replace(/.+#\d{4}/g, '[REDACTED_USER]');

  // 4. "Channel: …" context lines
  text = text.replace(/(Channel:\s*).+/g, '$1[REDACTED_CHANNEL]');

  // 5. Bare Discord snowflake IDs (catch-all, last)
  text = text.replace(/\b\d{17,20}\b/g, '[REDACTED_ID]');

  return text;
}

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
