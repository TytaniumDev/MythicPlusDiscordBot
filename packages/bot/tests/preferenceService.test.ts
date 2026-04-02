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
});
