import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BattleNetClient } from '../src/battlenet';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('BattleNetClient', () => {
  let client: BattleNetClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new BattleNetClient('test-client-id', 'test-client-secret');
  });

  describe('getToken', () => {
    it('fetches a new token from Battle.net OAuth', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });

      const token = await client.getToken();
      expect(token).toBe('abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://oauth.battle.net/token',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
        }),
      );
    });

    it('reuses cached token on subsequent calls', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });

      await client.getToken();
      await client.getToken();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('throws on auth failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      await expect(client.getToken()).rejects.toThrow('Battle.net OAuth failed: 401');
    });
  });

  describe('getCharacterProfile', () => {
    it('fetches character profile from Battle.net API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'Tytanium', character_class: { name: 'Warrior' } }),
      });

      const profile = await client.getCharacterProfile('us', 'stormrage', 'tytanium');
      expect(profile.name).toBe('Tytanium');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain('/profile/wow/character/stormrage/tytanium');
    });

    it('URL encodes realm and character name to prevent path traversal', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ name: 'Hack', character_class: { name: 'Rogue' } }),
      });

      await client.getCharacterProfile('us', 'area 52', '../hack');
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch.mock.calls[1][0]).toContain('/profile/wow/character/area%2052/..%2Fhack');
    });

    it('returns null when character is not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'abc123', expires_in: 86400 }),
      });
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const profile = await client.getCharacterProfile('us', 'stormrage', 'nonexistent');
      expect(profile).toBeNull();
    });
  });
});
