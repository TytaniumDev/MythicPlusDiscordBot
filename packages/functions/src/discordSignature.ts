import { createPublicKey, verify } from 'node:crypto';

// DER prefix that turns a raw 32-byte Ed25519 key into an SPKI public key.
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

/**
 * Check Discord's Ed25519 signature on an interaction request: the signature
 * covers the timestamp header followed by the raw body. Discord sends test
 * requests with bad signatures and expects them refused.
 */
export function verifyDiscordSignature(
  publicKeyHex: string,
  signatureHex: string,
  timestamp: string,
  rawBody: string,
): boolean {
  if (!/^[0-9a-f]{128}$/i.test(signatureHex) || !timestamp) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    return verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signatureHex, 'hex'));
  } catch {
    return false;
  }
}
