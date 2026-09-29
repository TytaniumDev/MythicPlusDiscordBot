import { useEffect, useRef } from 'react';
import { DEFAULT_REGION, parseInGameName } from '@mythicplus/shared';
import { useAppStore } from '../store/store';
import { firestoreService } from '../services/firestoreService';
import { lookupCharacter } from '../services/characterLookup';
import { needsPortraitRepair } from '../lib/profiles';
import { reportError } from '../lib/sentry';
import { useMyDiscordId } from './useSession';

/**
 * Once per session, fill in the current user's portrait when their profile
 * names a character but has none. Older versions of the activity could wipe
 * portraits, and nothing else looks a saved name up again until it's edited.
 * Live sessions only: demo mode and test fixtures have no guild.
 */
export function usePortraitRepair(): void {
  const discordId = useMyDiscordId();
  // undefined until the profile has loaded; null when there is no doc.
  const profile = useAppStore((s) => (discordId ? s.profiles[discordId] : undefined));
  const live = useAppStore((s) => !!s.currentGuildId && !s.isDemoMode);
  const checked = useRef(new Set<string>());

  useEffect(() => {
    if (!live || !discordId || profile === undefined || checked.current.has(discordId)) return;
    // Decide on the profile as it first loaded; later name edits look the
    // character up themselves.
    checked.current.add(discordId);
    if (!needsPortraitRepair(profile)) return;
    repairPortrait(discordId, profile.inGameName).catch((err: unknown) => {
      reportError(err, { tag: 'usePortraitRepair' });
    });
  }, [live, discordId, profile]);
}

async function repairPortrait(discordId: string, inGameName: string): Promise<void> {
  const parsed = parseInGameName(inGameName);
  if (!parsed) return;
  const result = await lookupCharacter(parsed.name, parsed.realmSlug, DEFAULT_REGION, { forceRefresh: true });
  if (result.status !== 'found' || !result.character.mediaUrl) return;

  // Leave the profile alone if it changed during the lookup: a new name, or a
  // portrait the editor saved.
  const current = useAppStore.getState().profiles[discordId];
  if (!needsPortraitRepair(current) || current.inGameName !== inGameName) return;

  await firestoreService.saveLinkedCharacter(
    discordId,
    { name: parsed.name, realm: parsed.realmSlug, region: DEFAULT_REGION },
    result.character.mediaUrl,
    result.character.class,
  );
}
