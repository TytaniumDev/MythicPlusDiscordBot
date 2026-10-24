import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyDiscordSignature } from '../src/discordSignature';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
// The raw key is the last 32 bytes of the SPKI encoding.
const publicKeyHex = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('hex');

function signed(timestamp: string, body: string): string {
  return sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
}

describe('verifyDiscordSignature', () => {
  const body = '{"type":1}';

  it('accepts a request Discord signed', () => {
    expect(verifyDiscordSignature(publicKeyHex, signed('1700000000', body), '1700000000', body)).toBe(true);
  });

  it('refuses a changed body or timestamp', () => {
    const signature = signed('1700000000', body);
    expect(verifyDiscordSignature(publicKeyHex, signature, '1700000000', '{"type":2}')).toBe(false);
    expect(verifyDiscordSignature(publicKeyHex, signature, '1700000001', body)).toBe(false);
  });

  it('refuses malformed signatures and keys', () => {
    expect(verifyDiscordSignature(publicKeyHex, 'abc', '1700000000', body)).toBe(false);
    expect(verifyDiscordSignature(publicKeyHex, '', '1700000000', body)).toBe(false);
    expect(verifyDiscordSignature('nothex', signed('1', body), '1', body)).toBe(false);
  });
});
