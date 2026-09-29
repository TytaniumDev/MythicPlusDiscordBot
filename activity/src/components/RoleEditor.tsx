import { useState, useCallback, useEffect, useRef } from 'react';
import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
import { SecondaryButton } from './ui';
import {
  playerRolesToStringArray,
  computeToggledRoles,
  MAIN_SPEC_BUTTONS,
  OFFSPEC_BUTTONS,
  UTILITY_BUTTONS,
  type RoleButtonDef,
} from '../lib/roles';
import { reportError } from '../lib/sentry';
import { saveStoredDiscordId } from '../lib/storedDiscordId';
import { parseInGameName, DEFAULT_REGION } from '@mythicplus/shared';

interface RoleEditorProps {
  /** Must carry a discordId: edits are written to preferences/{discordId}. */
  player: WoWPlayer;
  hideSitOut?: boolean;
}

const LOOKUP_DEBOUNCE_MS = 800;
const NAME_SAVE_DEBOUNCE_MS = 500;

const NOT_FOUND_MESSAGE = 'Character not found';
// The lookup failed, not the name (Battle.net down, rate limit, offline).
const LOOKUP_FAILED_MESSAGE = "Couldn't look up the character. Try again in a moment.";

export function RoleEditor({ player, hideSitOut }: RoleEditorProps) {
  const sittingOut = useAppStore((s) => s.channelData?.sittingOut) ?? [];
  const service = useSessionService();

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [inGameName, setInGameName] = useState('');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const { lookup, loading: lookupLoading } = useCharacterLookup();

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const rolesRef = useRef<Set<string>>(new Set());
  const nameRef = useRef<string>('');

  const playerId = player.discordId ?? null;

  // Sync roles when player data changes from Firestore (chips need to reflect
  // external updates). Bail when the role set hasn't changed — every snapshot
  // of the lobby's profiles hands us a new player object.
  useEffect(() => {
    const next = new Set(playerRolesToStringArray(player));
    setSelectedRoles((prev) => {
      if (prev.size === next.size && [...next].every((r) => prev.has(r))) return prev;
      return next;
    });
    rolesRef.current = next;
  }, [player]);

  // Seed the in-game name ONLY on player identity change. After mount, the
  // textbox is user-controlled — we never let a Firestore roundtrip overwrite
  // what the user has typed.
  useEffect(() => {
    setInGameName(player.inGameName ?? '');
    nameRef.current = player.inGameName ?? '';
    setLookupError(null);
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveRoles = useCallback(async (roles: Set<string>, name: string) => {
    const id = player.discordId;
    try {
      await service.saveRoles(id, Array.from(roles), name);
      const store = useAppStore.getState();
      if (!store.identityResolved && id === store.currentPlayerId) {
        store.setIdentity(id, player.name);
        store.setIdentityResolved(true);
        saveStoredDiscordId(id);
      }
    } catch (err) {
      reportError(err, { tag: 'RoleEditor.saveRoles' });
    }
  }, [player.discordId, player.name, service]);

  // Typing is debounced; role toggles save at once. Firestore shows either
  // write on this screen immediately, so the chips never flicker back.
  const saveNameSoon = useCallback((name: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveRoles(rolesRef.current, name);
    }, NAME_SAVE_DEBOUNCE_MS);
  }, [saveRoles]);

  const runLookup = useCallback(async (rawName: string) => {
    const parsed = parseInGameName(rawName);
    if (!parsed) {
      setLookupError(null);
      return;
    }

    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;

    try {
      const result = await lookup(parsed.name, parsed.realmSlug, DEFAULT_REGION);
      if (controller.signal.aborted) return;

      if (result.status !== 'found') {
        setLookupError(result.status === 'notFound' ? NOT_FOUND_MESSAGE : LOOKUP_FAILED_MESSAGE);
        return;
      }

      const { character } = result;
      setLookupError(null);

      await service.saveLinkedCharacter(
        player.discordId,
        { name: parsed.name, realm: parsed.realmSlug, region: DEFAULT_REGION },
        character.mediaUrl,
        character.class,
      );

      // Auto-assign roles only on the very first successful lookup for this player.
      // Read from rolesRef (not the player prop) — the prop is captured at the
      // time the debounce timer was set, so clicks during the 800ms window
      // would look like "no roles" here and clobber the user's selection.
      if (rolesRef.current.size === 0) {
        const roles: string[] = [];
        if (character.role === 'tank') roles.push('Tank');
        else if (character.role === 'healer') roles.push('Healer');
        else if (character.role === 'ranged') roles.push('Ranged');
        else if (character.role === 'melee') roles.push('Melee');
        for (const u of character.utilities) {
          if (u === 'brez') roles.push('Brez');
          if (u === 'lust') roles.push('Lust');
        }
        if (roles.length > 0) {
          const roleSet = new Set(roles);
          setSelectedRoles(roleSet);
          rolesRef.current = roleSet;
          await saveRoles(roleSet, rawName);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setLookupError(LOOKUP_FAILED_MESSAGE);
      reportError(err, { tag: 'RoleEditor.runLookup' });
    }
  }, [player.discordId, lookup, service, saveRoles]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
      lookupAbortRef.current?.abort();
    };
  }, []);

  const toggleRole = useCallback((btnDef: RoleButtonDef, mutuallyExclusive: boolean) => {
    const next = computeToggledRoles(rolesRef.current, btnDef.id, mutuallyExclusive);
    rolesRef.current = next;
    setSelectedRoles(next);
    void saveRoles(next, nameRef.current);
  }, [saveRoles]);

  const handleNameChange = useCallback((value: string) => {
    setInGameName(value);
    nameRef.current = value;
    setLookupError(null);
    saveNameSoon(value);

    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = setTimeout(() => runLookup(value), LOOKUP_DEBOUNCE_MS);
  }, [saveNameSoon, runLookup]);

  const isSittingOut = sittingOut.includes(player.discordId);

  function renderSection(label: string, buttons: RoleButtonDef[], mutuallyExclusive: boolean) {
    return (
      <div className="role-editor-section">
        <div className="role-editor-label">{label}</div>
        <div className="role-editor-row">
          {buttons.map((btnDef) => (
            <button
              key={btnDef.id}
              className={`role-btn${selectedRoles.has(btnDef.id) ? ` ${btnDef.activeClass}` : ''}`}
              data-role-id={btnDef.id}
              onClick={() => toggleRole(btnDef, mutuallyExclusive)}
              aria-pressed={selectedRoles.has(btnDef.id)}
            >
              {btnDef.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="role-editor-section">
        <div className="role-editor-label">In-Game Name</div>
        <div className="role-editor-row">
          <div className="role-editor-name-input">
            <input
              type="text"
              className="role-editor-input"
              placeholder="PlayerName-ServerName"
              value={inGameName}
              onChange={(e) => handleNameChange(e.target.value)}
              maxLength={50}
            />
            {lookupLoading && (
              <div className="character-search-loading" role="status" aria-live="polite" aria-label="Looking up character" />
            )}
          </div>
        </div>
        {lookupError && (
          <div className="role-editor-error" role="alert">{lookupError}</div>
        )}
      </div>

      {renderSection('Main Spec (pick one)', MAIN_SPEC_BUTTONS, true)}
      {renderSection('Offspec', OFFSPEC_BUTTONS, false)}
      {renderSection('Utilities', UTILITY_BUTTONS, false)}

      {!hideSitOut && (
        <div className="role-editor-section" style={{ marginTop: 4 }}>
          <div className="role-editor-row">
            <SecondaryButton
              className={`player-card__sit-out ${isSittingOut ? 'active-sitting-out' : ''}`}
              onClick={() => service.toggleSitOut(player.discordId)}
            >
              {isSittingOut ? 'Rejoin Round' : 'Sit Out This Round'}
            </SecondaryButton>
          </div>
        </div>
      )}
    </>
  );
}
