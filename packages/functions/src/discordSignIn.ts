import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getAuth } from 'firebase-admin/auth';
import { enforceRateLimit } from './rateLimit.js';

const DISCORD_API = 'https://discord.com/api/v10';

// Stored in Secret Manager. DISCORD_APPLICATION_ID is the same value as the
// bot's env var and the activity's VITE_DISCORD_CLIENT_ID.
const discordApplicationId = defineSecret('DISCORD_APPLICATION_ID');
const discordClientSecret = defineSecret('DISCORD_CLIENT_SECRET');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Trade the OAuth2 code from the activity's `authorize` call for an access
 * token. Returns null when Discord rejects the code (expired, reused, or
 * issued to another application).
 */
export async function exchangeDiscordCode(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code,
    }),
  });
  if (!response.ok) return null;
  const data: unknown = await response.json();
  return isRecord(data) && typeof data.access_token === 'string' ? data.access_token : null;
}

/** The Discord user ID (a numeric snowflake) the access token belongs to. */
export async function fetchDiscordUserId(accessToken: string): Promise<string | null> {
  const response = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const data: unknown = await response.json();
  return isRecord(data) && typeof data.id === 'string' && /^[0-9]+$/.test(data.id) ? data.id : null;
}

/**
 * Optional Discord sign-in for the activity. The client sends the code from
 * the Embedded App SDK's `authorize` command; this verifies it with Discord and
 * returns a Firebase custom token whose uid is the player's Discord ID. The
 * Discord access token never leaves this function.
 */
export const discordSignIn = onCall(
  { secrets: [discordApplicationId, discordClientSecret] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    await enforceRateLimit(request.auth.uid, 'discordSignIn', 10, 60000);

    const { code } = request.data as { code?: unknown };
    if (typeof code !== 'string' || code.length === 0 || code.length > 200) {
      throw new HttpsError('invalid-argument', 'code is required');
    }

    // Trim so a stray trailing newline in a stored secret can't break the exchange.
    const accessToken = await exchangeDiscordCode(
      code,
      discordApplicationId.value().trim(),
      discordClientSecret.value().trim(),
    );
    if (!accessToken) {
      throw new HttpsError('permission-denied', 'Discord rejected the authorization code');
    }

    const discordId = await fetchDiscordUserId(accessToken);
    if (!discordId) {
      throw new HttpsError('unavailable', 'Could not read the Discord user');
    }

    const customToken = await getAuth().createCustomToken(discordId);
    return { customToken };
  },
);
