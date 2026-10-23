/**
 * Redact Discord PII (snowflake IDs, user and channel names) from text bound
 * for a public GitHub issue.
 */
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
