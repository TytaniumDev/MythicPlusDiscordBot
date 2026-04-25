import { useCallback, useEffect, useState } from 'react';
import { clampKeyLevel, KEY_LEVEL_DEFAULT } from '../lib/keyLevel';

const STORAGE_KEY = 'wheelson-default-key-level';

function readStored(): number {
  try {
    return clampKeyLevel(localStorage.getItem(STORAGE_KEY));
  } catch {
    // intentional: storage unavailable (private mode / Safari ITP) — we
    // fall back to the default and accept that the preference won't persist.
    return KEY_LEVEL_DEFAULT;
  }
}

/**
 * Persistent "default key level" preference for the suggestions panel.
 *
 * Stored in localStorage so the user's chosen default survives reloads and
 * separate sessions. The setter writes immediately and reflects in any
 * other tab listening to `storage` events.
 *
 * The Results page seeds its initial selector from this default; per-session
 * tweaks on Results stay local to that session and don't write back here —
 * lobby is the only place the default is set.
 */
export function useDefaultKeyLevel(): readonly [number, (level: number) => void] {
  const [value, setValue] = useState<number>(() => readStored());

  // Cross-tab/window sync: pick up writes from another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setValue(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((level: number) => {
    const next = clampKeyLevel(level);
    setValue(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // intentional: storage unavailable (private mode / Safari ITP); the
      // in-memory state is still updated so the current tab works fine.
      void 0;
    }
  }, []);

  return [value, update] as const;
}
