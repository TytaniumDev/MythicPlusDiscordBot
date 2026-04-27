import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreferenceService } from '../src/core/preferenceService.js';
import { FirebaseService } from '../src/core/firebaseService.js';

function createMockFirebase(available: boolean): FirebaseService {
  const fb = Object.create(FirebaseService.prototype) as FirebaseService;
  fb.db = null;
  fb.isAvailable = vi.fn().mockReturnValue(available);
  return fb;
}

describe('PreferenceService', () => {
  let svc: PreferenceService;

  beforeEach(() => {
    const mockFb = createMockFirebase(false);
    svc = new PreferenceService(mockFb);
  });

  it('sets and gets preference sync', async () => {
    vi.mock('../src/core/storage.js', async (importOriginal) => {
      const original = (await importOriginal()) as Record<string, unknown>;
      return {
        ...original,
        setPlayerPreference: vi.fn(),
        clearPlayerPreference: vi.fn(),
        getPlayerPreference: vi.fn().mockReturnValue(null),
        getAllPreferences: vi.fn().mockReturnValue({}),
      };
    });

    await svc.setPreference('123', 'Martz', ['Tank', 'Brez']);
    const result = svc.getPreferenceSync('123');
    expect(result).toEqual(['Tank', 'Brez']);
  });

  it('gets by name sync', async () => {
    await svc.setPreference('123', 'Martz', ['Healer']);
    const result = svc.getPreferenceByNameSync('Martz');
    expect(result).toEqual(['Healer']);
  });

  it('clears preference', async () => {
    await svc.setPreference('123', 'Martz', ['Tank']);
    await svc.clearPreference('123');

    expect(svc.getPreferenceSync('123')).toBeNull();
    expect(svc.getPreferenceByNameSync('Martz')).toBeNull();
  });

  it('loads cache with local fallback', async () => {
    const mockFb = createMockFirebase(false);
    const localSvc = new PreferenceService(mockFb);

    // Mock the internal _loadFromLocal by providing mock storage
    const { getAllPreferences } = await import('../src/core/storage.js');
    vi.mocked(getAllPreferences).mockReturnValue({
      Martz: ['Tank'],
      Tytanium: ['Ranged'],
    });

    await localSvc.loadCache();

    expect(localSvc.getPreferenceByNameSync('Martz')).toEqual(['Tank']);
    expect(localSvc.getPreferenceByNameSync('Tytanium')).toEqual(['Ranged']);
  });

  it('refreshes preference and updates cache', async () => {
    const mockFb = createMockFirebase(true);
    const refreshSvc = new PreferenceService(mockFb);

    // Set initial state
    (refreshSvc as unknown as { _cache: Record<string, string[]> })._cache = {
      '123': ['Tank'],
    };
    (refreshSvc as unknown as { _nameToId: Record<string, string> })._nameToId = {
      OldName: '123',
    };

    // Mock the Firestore read
    refreshSvc._readFirestorePref = vi
      .fn()
      .mockResolvedValue({ roles: ['Ranged'], wowName: 'NewName' });

    await refreshSvc.refreshPreference('123');

    expect(refreshSvc.getPreferenceSync('123')).toEqual(['Ranged']);
    expect(refreshSvc.getPreferenceByNameSync('NewName')).toEqual(['Ranged']);
    expect(refreshSvc.getPreferenceByNameSync('OldName')).toBeNull();
  });

  it('gets preference from cache if available', async () => {
    await svc.setPreference('abc', 'Player1', ['Healer']);
    const result = await svc.getPreference('abc');
    expect(result).toEqual(['Healer']);
  });

  it('fetches preference from Firestore and updates cache if not available', async () => {
    const mockFb = createMockFirebase(true);
    const readSvc = new PreferenceService(mockFb);

    readSvc._readFirestorePref = vi.fn().mockResolvedValue({
      roles: ['Tank'],
      wowName: 'Player2',
      inGameName: 'Player2-Server',
      mediaUrl: 'https://example.com/avatar.png'
    });

    const result = await readSvc.getPreference('def');

    expect(result).toEqual(['Tank']);
    expect(readSvc.getPreferenceSync('def')).toEqual(['Tank']);
    expect(readSvc.getPreferenceByNameSync('Player2')).toEqual(['Tank']);
    expect(readSvc.getInGameNameSync('def')).toEqual('Player2-Server');
    expect(readSvc.getMediaUrlSync('def')).toEqual('https://example.com/avatar.png');
    expect(readSvc._readFirestorePref).toHaveBeenCalledWith('def');
  });

  it('returns null if Firestore fetch fails or missing', async () => {
    const mockFb = createMockFirebase(true);
    const readSvc = new PreferenceService(mockFb);

    readSvc._readFirestorePref = vi.fn().mockRejectedValue(new Error('Firestore error'));

    const result = await readSvc.getPreference('ghi');
    expect(result).toBeNull();
  });

  it('stores and retrieves inGameName', async () => {
    await svc.setPreference('456', 'Tytanium', ['Ranged'], 'Tytanium-Proudmoore');
    expect(svc.getInGameNameSync('456')).toBe('Tytanium-Proudmoore');
  });

  it('returns empty string for missing inGameName', () => {
    expect(svc.getInGameNameSync('nonexistent')).toBe('');
  });

  it('clears inGameName on clearPreference', async () => {
    await svc.setPreference('789', 'Player', ['Tank'], 'Player-Sargeras');
    expect(svc.getInGameNameSync('789')).toBe('Player-Sargeras');

    await svc.clearPreference('789');
    expect(svc.getInGameNameSync('789')).toBe('');
  });

  it('clears inGameName cache when set with empty string', async () => {
    await svc.setPreference('999', 'Player', ['Tank'], 'Player-Sargeras');
    expect(svc.getInGameNameSync('999')).toBe('Player-Sargeras');

    await svc.setPreference('999', 'Player', ['Healer'], '');
    expect(svc.getInGameNameSync('999')).toBe('');
  });

  it('refreshes preference removes on delete', async () => {
    const mockFb = createMockFirebase(true);
    const refreshSvc = new PreferenceService(mockFb);

    (refreshSvc as unknown as { _cache: Record<string, string[]> })._cache = {
      '123': ['Tank'],
    };
    (refreshSvc as unknown as { _nameToId: Record<string, string> })._nameToId = {
      Martz: '123',
    };

    refreshSvc._readFirestorePref = vi.fn().mockResolvedValue(null);

    await refreshSvc.refreshPreference('123');

    expect(refreshSvc.getPreferenceSync('123')).toBeNull();
    expect(refreshSvc.getPreferenceByNameSync('Martz')).toBeNull();
  });

  describe('Firestore CRUD helpers', () => {
    let mockDb: Record<string, ReturnType<typeof vi.fn>>;
    let mockDocRef: Record<string, ReturnType<typeof vi.fn>>;
    let mockCollectionRef: Record<string, ReturnType<typeof vi.fn>>;
    let readSvc: PreferenceService;

    beforeEach(() => {
      mockDocRef = {
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
      };
      mockCollectionRef = {
        doc: vi.fn().mockReturnValue(mockDocRef),
        get: vi.fn(),
      };
      mockDb = {
        collection: vi.fn().mockReturnValue(mockCollectionRef),
      };

      const mockFb = createMockFirebase(true);
      mockFb.db = mockDb as unknown as FirebaseService['db'];
      readSvc = new PreferenceService(mockFb);
    });

    it('_readFirestorePref returns data if doc exists', async () => {
      mockDocRef.get.mockResolvedValue({
        exists: true,
        data: () => ({ roles: ['Tank'] }),
      });
      const data = await readSvc._readFirestorePref('123');
      expect(data).toEqual({ roles: ['Tank'] });
      expect(mockDb.collection).toHaveBeenCalledWith('preferences');
      expect(mockCollectionRef.doc).toHaveBeenCalledWith('123');
    });

    it('_readFirestorePref returns null if doc does not exist', async () => {
      mockDocRef.get.mockResolvedValue({ exists: false });
      const data = await readSvc._readFirestorePref('123');
      expect(data).toBeNull();
    });

    it('_readFirestorePref returns null if db is not initialized', async () => {
      const mockFbNoDb = createMockFirebase(true);
      mockFbNoDb.db = null;
      const noDbSvc = new PreferenceService(mockFbNoDb);
      const data = await noDbSvc._readFirestorePref('123');
      expect(data).toBeNull();
    });

    it('_writeFirestorePref writes preference data with merge true', async () => {
      await readSvc._writeFirestorePref('123', 'Player1', ['Healer']);
      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: ['Healer'],
          wowName: 'Player1',
        }),
        { merge: true }
      );
      // Ensure inGameName wasn't included in payload
      const args = mockDocRef.set.mock.calls[0][0];
      expect(args).not.toHaveProperty('inGameName');
    });

    it('_writeFirestorePref includes inGameName if provided', async () => {
      await readSvc._writeFirestorePref('123', 'Player1', ['Healer'], 'Player1-Realm');
      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          roles: ['Healer'],
          wowName: 'Player1',
          inGameName: 'Player1-Realm',
        }),
        { merge: true }
      );
    });

    it('_writeFirestorePref does nothing if db is not initialized', async () => {
      const mockFbNoDb = createMockFirebase(true);
      mockFbNoDb.db = null;
      const noDbSvc = new PreferenceService(mockFbNoDb);
      await noDbSvc._writeFirestorePref('123', 'P1', []);
      expect(mockDocRef.set).not.toHaveBeenCalled();
    });

    it('_deleteFirestorePref deletes doc', async () => {
      await readSvc._deleteFirestorePref('123');
      expect(mockDocRef.delete).toHaveBeenCalled();
    });

    it('_deleteFirestorePref does nothing if db is not initialized', async () => {
      const mockFbNoDb = createMockFirebase(true);
      mockFbNoDb.db = null;
      const noDbSvc = new PreferenceService(mockFbNoDb);
      await noDbSvc._deleteFirestorePref('123');
      expect(mockDocRef.delete).not.toHaveBeenCalled();
    });
  });

  describe('loadCache fallbacks', () => {
    it('loadCache falls back to local and logs error if fetching fails', async () => {
      const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockRejectedValue(new Error('Fetch failed')),
        }),
      };
      const mockFb = createMockFirebase(true);
      mockFb.db = mockDb as unknown as FirebaseService['db'];
      const testSvc = new PreferenceService(mockFb);

      const { getAllPreferences } = await import('../src/core/storage.js');
      vi.mocked(getAllPreferences).mockReturnValue({
        FallbackPlayer: ['Healer'],
      });

      await testSvc.loadCache();

      expect(testSvc.getPreferenceByNameSync('FallbackPlayer')).toEqual(['Healer']);
    });

    it('_fetchAllPreferences handles null db', async () => {
      const mockFb = createMockFirebase(true);
      mockFb.db = null;
      const testSvc = new PreferenceService(mockFb);
      const docs = await (testSvc as unknown as { _fetchAllPreferences: () => Promise<unknown> })._fetchAllPreferences();
      expect(docs).toEqual({});
    });
  });

  describe('loadCache hydrates sync caches', () => {
    it('hydrates characterClass, mediaUrl, inGameName, and name->id caches from Firestore', async () => {
      const mockSnapshot = {
        docs: [
          {
            id: 'discord-1',
            data: () => ({
              roles: ['Tank', 'Brez'],
              wowName: 'Martz',
              inGameName: 'Martz-Sargeras',
              mediaUrl: 'https://example.com/martz.png',
              characterClass: 'Paladin',
            }),
          },
          {
            id: 'discord-2',
            data: () => ({
              roles: ['Healer'],
              wowName: 'Tytanium',
              inGameName: 'Tytanium-Proudmoore',
              mediaUrl: 'https://example.com/tytanium.png',
              characterClass: 'Priest',
            }),
          },
        ],
      };
      const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockSnapshot),
        }),
      };
      const mockFb = createMockFirebase(true);
      mockFb.db = mockDb as unknown as FirebaseService['db'];
      const testSvc = new PreferenceService(mockFb);

      await testSvc.loadCache();

      expect(testSvc.getCharacterClassSync('discord-1')).toBe('Paladin');
      expect(testSvc.getMediaUrlSync('discord-1')).toBe('https://example.com/martz.png');
      expect(testSvc.getInGameNameSync('discord-1')).toBe('Martz-Sargeras');
      expect(testSvc.getPreferenceByNameSync('Martz')).toEqual(['Tank', 'Brez']);

      expect(testSvc.getCharacterClassSync('discord-2')).toBe('Priest');
      expect(testSvc.getMediaUrlSync('discord-2')).toBe('https://example.com/tytanium.png');
      expect(testSvc.getInGameNameSync('discord-2')).toBe('Tytanium-Proudmoore');
      expect(testSvc.getPreferenceByNameSync('Tytanium')).toEqual(['Healer']);
    });

    it('skips optional fields when missing from Firestore docs', async () => {
      const mockSnapshot = {
        docs: [
          {
            id: 'discord-3',
            data: () => ({ roles: ['Ranged'], wowName: 'Sparse' }),
          },
          // Doc with null data should be filtered out
          { id: 'discord-null', data: () => null },
        ],
      };
      const mockDb: Record<string, ReturnType<typeof vi.fn>> = {
        collection: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue(mockSnapshot),
        }),
      };
      const mockFb = createMockFirebase(true);
      mockFb.db = mockDb as unknown as FirebaseService['db'];
      const testSvc = new PreferenceService(mockFb);

      await testSvc.loadCache();

      expect(testSvc.getPreferenceSync('discord-3')).toEqual(['Ranged']);
      expect(testSvc.getInGameNameSync('discord-3')).toBe('');
      expect(testSvc.getMediaUrlSync('discord-3')).toBeNull();
      expect(testSvc.getCharacterClassSync('discord-3')).toBeNull();
      // Null-data doc is excluded
      expect(testSvc.getPreferenceSync('discord-null')).toBeNull();
    });
  });

  describe('resolveDiscordId', () => {
    it('returns the discordId after setPreference registers the name mapping', async () => {
      await svc.setPreference('discord-42', 'Martz', ['Tank']);
      expect(svc.resolveDiscordId('Martz')).toBe('discord-42');
    });

    it('returns null for an unknown name', () => {
      expect(svc.resolveDiscordId('NobodyHere')).toBeNull();
    });
  });

  describe('clearPreference purges all sync caches', () => {
    it('removes characterClass and mediaUrl cache entries on clearPreference', async () => {
      const mockFb = createMockFirebase(true);
      const testSvc = new PreferenceService(mockFb);

      // Hydrate caches via getPreference + Firestore mock so all four caches populate
      testSvc._readFirestorePref = vi.fn().mockResolvedValue({
        roles: ['Tank'],
        wowName: 'Martz',
        inGameName: 'Martz-Sargeras',
        mediaUrl: 'https://example.com/avatar.png',
        characterClass: 'Warrior',
      });
      testSvc._deleteFirestorePref = vi.fn().mockResolvedValue(undefined);

      await testSvc.getPreference('discord-1');

      expect(testSvc.getCharacterClassSync('discord-1')).toBe('Warrior');
      expect(testSvc.getMediaUrlSync('discord-1')).toBe('https://example.com/avatar.png');
      expect(testSvc.getInGameNameSync('discord-1')).toBe('Martz-Sargeras');
      expect(testSvc.resolveDiscordId('Martz')).toBe('discord-1');

      await testSvc.clearPreference('discord-1');

      expect(testSvc.getPreferenceSync('discord-1')).toBeNull();
      expect(testSvc.getCharacterClassSync('discord-1')).toBeNull();
      expect(testSvc.getMediaUrlSync('discord-1')).toBeNull();
      expect(testSvc.getInGameNameSync('discord-1')).toBe('');
      expect(testSvc.resolveDiscordId('Martz')).toBeNull();
    });
  });

  describe('refreshPreference removes stale optional fields', () => {
    it('deletes cached characterClass and mediaUrl when payload omits them', async () => {
      const mockFb = createMockFirebase(true);
      const testSvc = new PreferenceService(mockFb);

      // Pre-populate caches with stale values
      const internals = testSvc as unknown as {
        _cache: Record<string, string[]>;
        _nameToId: Record<string, string>;
        _inGameNameCache: Record<string, string>;
        _mediaUrlCache: Record<string, string>;
        _characterClassCache: Record<string, string>;
      };
      internals._cache['discord-1'] = ['Tank'];
      internals._nameToId['OldName'] = 'discord-1';
      internals._inGameNameCache['discord-1'] = 'Old-Realm';
      internals._mediaUrlCache['discord-1'] = 'https://example.com/old.png';
      internals._characterClassCache['discord-1'] = 'Paladin';

      // Refresh payload omits inGameName, mediaUrl, characterClass entirely
      testSvc._readFirestorePref = vi
        .fn()
        .mockResolvedValue({ roles: ['Healer'], wowName: 'NewName' });

      await testSvc.refreshPreference('discord-1');

      expect(testSvc.getPreferenceSync('discord-1')).toEqual(['Healer']);
      expect(testSvc.resolveDiscordId('NewName')).toBe('discord-1');
      expect(testSvc.resolveDiscordId('OldName')).toBeNull();
      // The else-branches in refreshPreference should have wiped these
      expect(testSvc.getInGameNameSync('discord-1')).toBe('');
      expect(testSvc.getMediaUrlSync('discord-1')).toBeNull();
      expect(testSvc.getCharacterClassSync('discord-1')).toBeNull();
    });
  });
});
