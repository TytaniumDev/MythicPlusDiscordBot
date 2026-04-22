import { useState, useCallback, useEffect, useRef } from 'react';
import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
import { SecondaryButton } from './ui';
import {
  playerRolesToStringArray,
  roleStringsToPlayerFields,
  computeToggledRoles,
  MAIN_SPEC_BUTTONS,
  OFFSPEC_BUTTONS,
  UTILITY_BUTTONS,
  type RoleButtonDef,
} from '../lib/roles';
import { reportError } from '../lib/sentry';

interface RoleEditorProps {
  player: WoWPlayer;
  onMediaUrlChange?: (url: string | null) => void;
  hideSitOut?: boolean;
}

const LOOKUP_DEBOUNCE_MS = 800;
const DEFAULT_REGION = 'us';

// Best-effort realm display → slug conversion. Battle.net's realm-slug
// endpoint is authoritative, but for typical US realms this is correct
// (`Area 52` → `area-52`, `Kel'Thuzad` → `kelthuzad`). Failures surface as
// "Character not found", which doubles as a typo check.
function realmToSlug(realm: string): string {
  return realm.trim().toLowerCase().replace(/'/g, '').replace(/\s+/g, '-');
}

function parseInGameName(input: string): { name: string; realmSlug: string } | null {
  const trimmed = input.trim();
  const dashIdx = trimmed.indexOf('-');
  if (dashIdx === -1) return null;
  const name = trimmed.slice(0, dashIdx).trim();
  const realm = trimmed.slice(dashIdx + 1).trim();
  if (!name || !realm) return null;
  return { name, realmSlug: realmToSlug(realm) };
}

export function RoleEditor({ player, onMediaUrlChange, hideSitOut }: RoleEditorProps) {
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
  // external updates). Bail when the role set hasn't changed — `autoSave`
  // optimistically updates the store on every keystroke, so this effect fires
  // frequently during typing.
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

  const autoSave = useCallback((roles: Set<string>, name: string) => {
    if (!player.discordId) return;

    const id = player.discordId;
    queueMicrotask(() => {
      const fields = roleStringsToPlayerFields(roles);
      useAppStore.getState().updatePlayer(id, { ...fields, inGameName: name || undefined });
    });

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    saveTimerRef.current = setTimeout(async () => {
      try {
        await service.saveRoles(player.discordId!, player.name, Array.from(roles), name);
        const store = useAppStore.getState();
        if (!store.identityResolved && player.discordId === store.currentPlayerId) {
          store.setIdentity(player.discordId!, player.name);
          store.setIdentityResolved(true);
          const guildId = store.currentGuildId;
          localStorage.setItem(`wheelson-player-${guildId ?? 'unknown'}`, player.discordId!);
        }
      } catch (err) {
        reportError(err, { tag: 'RoleEditor.autoSave' });
      }
    }, 500);
  }, [player.discordId, player.name, service]);

  const runLookup = useCallback(async (rawName: string) => {
    if (!player.discordId) return;

    const parsed = parseInGameName(rawName);
    if (!parsed) {
      setLookupError(null);
      return;
    }

    lookupAbortRef.current?.abort();
    const controller = new AbortController();
    lookupAbortRef.current = controller;

    try {
      const character = await lookup(parsed.name, parsed.realmSlug, DEFAULT_REGION);
      if (controller.signal.aborted) return;

      if (!character) {
        setLookupError('Character not found');
        return;
      }

      setLookupError(null);
      if (character.mediaUrl) onMediaUrlChange?.(character.mediaUrl);

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
          await service.saveRoles(player.discordId, player.name, roles, rawName);
        }
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      setLookupError('Character not found');
      reportError(err, { tag: 'RoleEditor.runLookup' });
    }
  }, [player, lookup, service, onMediaUrlChange]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
      lookupAbortRef.current?.abort();
    };
  }, []);

  const toggleRole = useCallback((btnDef: RoleButtonDef, mutuallyExclusive: boolean) => {
    setSelectedRoles((prev) => {
      const next = computeToggledRoles(prev, btnDef.id, mutuallyExclusive);
      rolesRef.current = next;
      autoSave(next, nameRef.current);
      return next;
    });
  }, [autoSave]);

  const handleNameChange = useCallback((value: string) => {
    setInGameName(value);
    nameRef.current = value;
    setLookupError(null);
    autoSave(rolesRef.current, value);

    if (lookupTimerRef.current) clearTimeout(lookupTimerRef.current);
    lookupTimerRef.current = setTimeout(() => runLookup(value), LOOKUP_DEBOUNCE_MS);
  }, [autoSave, runLookup]);

  const isSittingOut = player.discordId ? sittingOut.includes(player.discordId) : false;

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
              onClick={() => { if (player.discordId) service.toggleSitOut(player.discordId); }}
            >
              {isSittingOut ? 'Rejoin Round' : 'Sit Out This Round'}
            </SecondaryButton>
          </div>
        </div>
      )}
    </>
  );
}
