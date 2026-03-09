import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import {
  STORAGE_FILE,
  loadPreferences,
  savePreferences,
  getPlayerPreference,
  setPlayerPreference,
  clearPlayerPreference,
  getAllPreferences,
  _resetCache,
} from '../src/core/storage.js';

describe('Storage', () => {
  let backupExists = false;

  beforeEach(() => {
    backupExists = fs.existsSync(STORAGE_FILE);
    if (backupExists) {
      fs.renameSync(STORAGE_FILE, STORAGE_FILE + '.bak');
    }
    _resetCache();
  });

  afterEach(() => {
    if (fs.existsSync(STORAGE_FILE)) {
      fs.unlinkSync(STORAGE_FILE);
    }
    if (backupExists) {
      fs.renameSync(STORAGE_FILE + '.bak', STORAGE_FILE);
    }
    _resetCache();
  });

  it('caches after first load', () => {
    const initialData = { Player1: ['Tank'] };
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(initialData));

    const data1 = loadPreferences();
    expect(data1).toEqual(initialData);

    // Modify file on disk — cache should return old value
    fs.writeFileSync(STORAGE_FILE, JSON.stringify({ Player1: ['Healer'] }));
    const data2 = loadPreferences();
    expect(data2).toEqual(initialData);
  });

  it('saves and loads', () => {
    const prefs = { Player1: ['Tank', 'Melee'] };
    savePreferences(prefs);
    _resetCache(); // Force re-read from disk
    const loaded = loadPreferences();
    expect(loaded).toEqual(prefs);
  });

  it('gets and sets preference', () => {
    setPlayerPreference('Player2', ['Healer']);
    expect(getPlayerPreference('Player2')).toEqual(['Healer']);
    expect(getPlayerPreference('NonExistent')).toBeNull();
  });

  it('clears preference', () => {
    setPlayerPreference('Player3', ['Melee']);
    expect(clearPlayerPreference('Player3')).toBe(true);
    expect(getPlayerPreference('Player3')).toBeNull();
    expect(clearPlayerPreference('Player3')).toBe(false);
  });

  it('gets all preferences', () => {
    setPlayerPreference('P1', ['Role1']);
    setPlayerPreference('P2', ['Role2']);
    const allPrefs = getAllPreferences();
    expect(Object.keys(allPrefs).length).toBe(2);
    expect(allPrefs).toHaveProperty('P1');
    expect(allPrefs).toHaveProperty('P2');
  });

  it('handles corrupt file', () => {
    fs.writeFileSync(STORAGE_FILE, '{invalid json');
    const prefs = loadPreferences();
    expect(prefs).toEqual({});
  });

  it('returns empty when file does not exist', () => {
    const prefs = loadPreferences();
    expect(prefs).toEqual({});
  });
});
