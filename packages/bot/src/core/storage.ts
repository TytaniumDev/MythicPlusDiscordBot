import fs from 'node:fs';
import path from 'node:path';
import { reportError } from './sentry.js';

const PREFERENCES_PATH = process.env.PREFERENCES_PATH;
const DATA_DIR = process.env.DATA_DIR;

export const STORAGE_FILE: string =
  PREFERENCES_PATH ??
  (DATA_DIR ? path.join(DATA_DIR, 'player_preferences.json') : null) ??
  'player_preferences.json';

let preferencesCache: Record<string, string[]> | null = null;

function ensureLoaded(): void {
  if (preferencesCache !== null) return;

  if (fs.existsSync(STORAGE_FILE)) {
    try {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf-8');
      preferencesCache = JSON.parse(raw) as Record<string, string[]>;
    } catch (e) {
      reportError(e, { tags: { handler: 'storage.loadPreferences' } });
      preferencesCache = {};
    }
  } else {
    preferencesCache = {};
  }
}

export function loadPreferences(): Record<string, string[]> {
  ensureLoaded();
  return { ...(preferencesCache ?? {}) };
}

export function savePreferences(preferences: Record<string, string[]>): void {
  try {
    preferencesCache = preferences;
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(preferences, null, 4));
  } catch (e) {
    reportError(e, { tags: { handler: 'storage.savePreferences' } });
  }
}

export function getPlayerPreference(playerName: string): string[] | null {
  ensureLoaded();
  return preferencesCache?.[playerName] ?? null;
}

export function setPlayerPreference(playerName: string, roles: string[]): void {
  const prefs = loadPreferences();
  prefs[playerName] = roles;
  savePreferences(prefs);
}

export function clearPlayerPreference(playerName: string): boolean {
  const prefs = loadPreferences();
  if (playerName in prefs) {
    Reflect.deleteProperty(prefs, playerName);
    savePreferences(prefs);
    return true;
  }
  return false;
}

export function getAllPreferences(): Record<string, string[]> {
  return loadPreferences();
}

/** Reset cache — for testing only. */
export function _resetCache(): void {
  preferencesCache = null;
}
