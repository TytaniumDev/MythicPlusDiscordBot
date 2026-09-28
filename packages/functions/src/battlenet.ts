import { defineSecret } from 'firebase-functions/params';

const REGION_HOSTS: Record<string, string> = {
  us: 'us.api.blizzard.com',
  eu: 'eu.api.blizzard.com',
  kr: 'kr.api.blizzard.com',
  tw: 'tw.api.blizzard.com',
};

export class BattleNetClient {
  private token: string | null = null;
  private tokenExpiry = 0;

  constructor(
    private clientId: string,
    private clientSecret: string,
  ) {}

  async getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiry) return this.token;

    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch('https://oauth.battle.net/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Battle.net OAuth failed: ${response.status}`);
    }

    const data = await response.json();
    const token: string = data.access_token;
    this.token = token;
    this.tokenExpiry = Date.now() + (data.expires_in - 300) * 1000;
    return token;
  }

  async apiCall(region: string, path: string): Promise<Response> {
    const token = await this.getToken();
    const host = REGION_HOSTS[region] ?? REGION_HOSTS.us;
    return fetch(`https://${host}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });
  }

  async getCharacterProfile(region: string, realmSlug: string, characterName: string) {
    const encodedRealm = encodeURIComponent(realmSlug);
    const encodedName = encodeURIComponent(characterName.toLowerCase());
    const response = await this.apiCall(
      region,
      `/profile/wow/character/${encodedRealm}/${encodedName}?namespace=profile-${region}&locale=en_US`,
    );
    if (!response.ok) return null;
    return response.json();
  }

  async getCharacterMedia(region: string, realmSlug: string, characterName: string) {
    const encodedRealm = encodeURIComponent(realmSlug);
    const encodedName = encodeURIComponent(characterName.toLowerCase());
    const response = await this.apiCall(
      region,
      `/profile/wow/character/${encodedRealm}/${encodedName}/character-media?namespace=profile-${region}&locale=en_US`,
    );
    if (!response.ok) return null;
    return response.json();
  }

  async getCharacterSpecializations(region: string, realmSlug: string, characterName: string) {
    const encodedRealm = encodeURIComponent(realmSlug);
    const encodedName = encodeURIComponent(characterName.toLowerCase());
    const response = await this.apiCall(
      region,
      `/profile/wow/character/${encodedRealm}/${encodedName}/specializations?namespace=profile-${region}&locale=en_US`,
    );
    if (!response.ok) return null;
    return response.json();
  }

  async getMythicKeystonePeriodIndex(region: string) {
    const response = await this.apiCall(
      region,
      `/data/wow/mythic-keystone/period/index?namespace=dynamic-${region}&locale=en_US`,
    );
    if (!response.ok) return null;
    return response.json();
  }
}

// Stored in Secret Manager. Every function that calls getBattleNetClient()
// must list these in its `secrets` option, or value() is empty at runtime.
const bnetClientId = defineSecret('BNET_CLIENT_ID');
const bnetClientSecret = defineSecret('BNET_CLIENT_SECRET');
export const battleNetSecrets = [bnetClientId, bnetClientSecret];

// Module-scope singleton — survives across warm Cloud Function invocations,
// allowing the OAuth token to be cached between requests.
let _client: BattleNetClient | null = null;

export function getBattleNetClient(): BattleNetClient {
  if (!_client) {
    const clientId = bnetClientId.value();
    const clientSecret = bnetClientSecret.value();
    if (!clientId || !clientSecret) {
      throw new Error('BNET_CLIENT_ID and BNET_CLIENT_SECRET secrets are not available');
    }
    _client = new BattleNetClient(clientId, clientSecret);
  }
  return _client;
}
