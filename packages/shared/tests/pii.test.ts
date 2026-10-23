import { describe, expect, it } from 'vitest';
import { obfuscatePii } from '../src/pii';

describe('obfuscatePii', () => {
  it('redacts Discord object repr', () => {
    const text = "<Member id=123456789012345678 name='JohnDoe' discriminator='1234'>";
    const result = obfuscatePii(text);
    expect(result).not.toContain('123456789012345678');
    expect(result).not.toContain('JohnDoe');
    expect(result).toContain('[REDACTED_ID]');
    expect(result).toContain('[REDACTED]');
  });

  it('redacts voice channel repr', () => {
    const text = "<VoiceChannel id=987654321098765432 name='Gaming Lounge'>";
    const result = obfuscatePii(text);
    expect(result).not.toContain('987654321098765432');
    expect(result).not.toContain('Gaming Lounge');
  });

  it('redacts user context line', () => {
    const text = 'User: JohnDoe (123456789012345678)';
    const result = obfuscatePii(text);
    expect(result).not.toContain('JohnDoe');
    expect(result).not.toContain('123456789012345678');
    expect(result).toContain('[REDACTED_USER]');
    expect(result).toContain('[REDACTED_ID]');
  });

  it('redacts channel context line', () => {
    const text = 'Channel: #my-secret-channel';
    const result = obfuscatePii(text);
    expect(result).not.toContain('my-secret-channel');
    expect(result).toContain('[REDACTED_CHANNEL]');
  });

  it('redacts bare snowflake IDs', () => {
    const text = 'Error for guild 123456789012345678 in channel 987654321098765432';
    const result = obfuscatePii(text);
    expect(result).not.toContain('123456789012345678');
    expect(result).not.toContain('987654321098765432');
    expect(result.match(/\[REDACTED_ID\]/g)?.length).toBe(2);
  });

  it('preserves short numbers', () => {
    const text = 'Error code 12345 at line 67';
    expect(obfuscatePii(text)).toBe(text);
  });

  it('redacts username#discriminator', () => {
    const text = 'Something about CoolUser#9876 happened';
    const result = obfuscatePii(text);
    expect(result).not.toContain('CoolUser#9876');
    expect(result).toContain('[REDACTED_USER]');
  });

  it('redacts username with spaces#discriminator', () => {
    const text = 'Something about Cool User#9876 happened';
    const result = obfuscatePii(text);
    expect(result).not.toContain('Cool User#9876');
    expect(result).toContain('[REDACTED_USER]');
  });

  it("redacts Discord object repr with single quote in name", () => {
    const text =
      "<Member id=123456789012345678 name='O'Reilly' discriminator='1234'>";
    const result = obfuscatePii(text);
    expect(result).not.toContain("O'Reilly");
    expect(result).not.toContain('123456789012345678');
  });

  it('redacts user context with parens in name', () => {
    const text = 'User: Name(Tag) (123456789012345678)';
    const result = obfuscatePii(text);
    expect(result).not.toContain('Name(Tag)');
    expect(result).not.toContain('123456789012345678');
  });

  it('handles empty string', () => {
    expect(obfuscatePii('')).toBe('');
  });

  it('handles no PII', () => {
    const text = 'Just a normal error message with no PII';
    expect(obfuscatePii(text)).toBe(text);
  });

  it('preserves code paths', () => {
    const text = 'File "/app/cogs/groups.py", line 45, in wheel';
    expect(obfuscatePii(text)).toBe(text);
  });

  it('handles full context string', () => {
    const text = [
      'App Command: /wheel',
      'User: Tytanium (202184987469021184)',
      "Channel: <VoiceChannel id=123456789012345678 name='Gaming'>",
    ].join('\n');
    const result = obfuscatePii(text);
    expect(result).not.toContain('Tytanium');
    expect(result).not.toContain('202184987469021184');
    expect(result).not.toContain('Gaming');
    expect(result).toContain('/wheel');
  });
});
