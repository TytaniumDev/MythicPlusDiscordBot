/**
 * The current user's Discord ID, remembered in localStorage so a returning
 * player is recognised before identity resolves. Only the ID is stored: the
 * profile itself always comes from `preferences/{discordId}`.
 */
export const DISCORD_ID_KEY = 'wheelson-discord-id';
const LEGACY_PREFIX = 'wheelson-player-';
/** Profile copy that older builds kept in localStorage. */
const LEGACY_CHARACTER_KEY = 'wheelson-character';

export function loadStoredDiscordId(): string | null {
  return localStorage.getItem(DISCORD_ID_KEY);
}

export function saveStoredDiscordId(discordId: string): void {
  localStorage.setItem(DISCORD_ID_KEY, discordId);
}

/**
 * One-shot cleanup of keys older builds wrote. Called once on app boot:
 * copies a legacy per-guild Discord ID key into the global key (when that
 * isn't set yet) and drops the retired local profile copy.
 */
export function migrateLegacyStorage(): void {
  localStorage.removeItem(LEGACY_CHARACTER_KEY);
  if (localStorage.getItem(DISCORD_ID_KEY)) return;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(LEGACY_PREFIX)) {
      const value = localStorage.getItem(key);
      if (value) {
        localStorage.setItem(DISCORD_ID_KEY, value);
        return;
      }
    }
  }
}
