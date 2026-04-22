import { useState, useCallback, useEffect, useRef } from 'react';
import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
import { CharacterSearchInput, SecondaryButton } from './ui';
import {
  playerRolesToStringArray,
  roleStringsToPlayerFields,
  computeToggledRoles,
  MAIN_SPEC_BUTTONS,
  OFFSPEC_BUTTONS,
  UTILITY_BUTTONS,
  type RoleButtonDef,
} from '../lib/roles';
import { searchCharacters, type RaiderioCharacterResult } from '../services/raiderioService';
import { reportError } from '../lib/sentry';

interface RoleEditorProps {
  player: WoWPlayer;
  onMediaUrlChange?: (url: string | null) => void;
  hideSitOut?: boolean;
}

export function RoleEditor({ player, onMediaUrlChange, hideSitOut }: RoleEditorProps) {
  const sittingOut = useAppStore((s) => s.channelData?.sittingOut) ?? [];
  const service = useSessionService();

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [inGameName, setInGameName] = useState('');

  const { lookup, loading: lookupLoading } = useCharacterLookup();

  // Auto-save timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rolesRef = useRef<Set<string>>(new Set());
  const nameRef = useRef<string>('');
  const autoLookupAttemptedRef = useRef<string | null>(null);

  const playerId = player.discordId ?? null;

  // Sync roles when player data changes from Firestore (chips need to reflect
  // external updates).
  useEffect(() => {
    const roles = new Set(playerRolesToStringArray(player));
    setSelectedRoles(roles);
    rolesRef.current = roles;
  }, [player]);

  // Seed the in-game name ONLY on player identity change. After mount, the
  // textbox is user-controlled — we never let a Firestore roundtrip overwrite
  // what the user has typed (e.g. replacing "Name-Realm" with a partial or
  // name-only value from the bot's cache). Users always enter the full
  // `Name-Realm` form; clicking a suggestion also produces `Name-Realm`.
  useEffect(() => {
    setInGameName(player.inGameName ?? '');
    nameRef.current = player.inGameName ?? '';
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save when roles or name change
  const autoSave = useCallback((roles: Set<string>, name: string) => {
    if (!player.discordId) return;

    // Optimistically update the store so chips reflect changes immediately
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

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Auto-populate character image when a player already has an inGameName saved
  // but no mediaUrl (e.g. name was entered in an older build or a previous session).
  // Runs once per player identity; uses the initial snapshot to avoid firing while
  // the user is typing. Failures are non-fatal.
  useEffect(() => {
    const discordId = player.discordId;
    if (!discordId) return;
    if (autoLookupAttemptedRef.current === discordId) return;

    const name = player.inGameName?.trim();
    if (!name || player.mediaUrl) return;
    autoLookupAttemptedRef.current = discordId;

    const controller = new AbortController();
    const dashIdx = name.indexOf('-');
    const namePart = dashIdx === -1 ? name : name.slice(0, dashIdx);
    const realmPart = dashIdx === -1 ? '' : name.slice(dashIdx + 1);

    (async () => {
      try {
        const matches = await searchCharacters(name, controller.signal);
        if (controller.signal.aborted || matches.length === 0) return;

        const exact = matches.find(
          (m) =>
            m.name.toLowerCase() === namePart.toLowerCase() &&
            (!realmPart ||
              m.realm.toLowerCase() === realmPart.toLowerCase() ||
              m.realmSlug.toLowerCase() === realmPart.toLowerCase()),
        );
        // If the saved name includes a realm but no match confirms it, skip —
        // falling back to matches[0] could silently load the wrong character.
        if (!exact && realmPart) return;
        const match = exact ?? matches[0];

        const character = await lookup(match.name, match.realmSlug, match.region, { silent: true });
        if (controller.signal.aborted || !character?.mediaUrl) return;

        onMediaUrlChange?.(character.mediaUrl);
        await service.saveLinkedCharacter(
          discordId,
          { name: match.name, realm: match.realmSlug, region: match.region },
          character.mediaUrl,
          character.class,
        );
      } catch (err) {
        if (controller.signal.aborted) return;
        reportError(err, { tag: 'RoleEditor.autoLoadMedia' });
      }
    })();

    return () => {
      controller.abort();
    };
    // Intentionally depend only on playerId — we take a snapshot of the player's
    // inGameName/mediaUrl at mount and don't want to re-fire on typing changes.
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

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
    autoSave(rolesRef.current, value);
  }, [autoSave]);

  const handleCharacterSelect = useCallback(async (result: RaiderioCharacterResult) => {
    if (lookupLoading || !player.discordId) return;

    // onChange already set nameRef to "Name-Realm"; cancel debounce to avoid racing the explicit save below.
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const nameToSave = nameRef.current;

    const character = await lookup(result.name, result.realmSlug, result.region);
    if (character) {
      if (character.mediaUrl) onMediaUrlChange?.(character.mediaUrl);

      // Save linkedCharacter + mediaUrl BEFORE saveRoles so the bot's
      // refreshPlayers cycle reads the mediaUrl from the preference doc.
      await service.saveLinkedCharacter(player.discordId, {
        name: result.name,
        realm: result.realmSlug,
        region: result.region,
      }, character.mediaUrl, character.class);

      const currentRoles = playerRolesToStringArray(player);
      if (currentRoles.length === 0) {
        const roles: string[] = [];
        if (character.role === 'tank') roles.push('Tank');
        else if (character.role === 'healer') roles.push('Healer');
        else if (character.role === 'ranged') roles.push('Ranged');
        else if (character.role === 'melee') roles.push('Melee');
        for (const u of character.utilities) {
          if (u === 'brez') roles.push('Brez');
          if (u === 'lust') roles.push('Lust');
        }
        const roleSet = new Set(roles);
        setSelectedRoles(roleSet);
        rolesRef.current = roleSet;
        await service.saveRoles(player.discordId, player.name, roles, nameToSave);
      } else {
        await service.saveRoles(player.discordId, player.name, Array.from(rolesRef.current), nameToSave);
      }
    }
  }, [lookupLoading, player, lookup, service, onMediaUrlChange]);

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
          <CharacterSearchInput
            value={inGameName}
            onChange={handleNameChange}
            onSelect={handleCharacterSelect}
            loading={lookupLoading}
          />
        </div>
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
