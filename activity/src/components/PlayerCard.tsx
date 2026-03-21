import { useState, useCallback, useEffect, useRef } from 'react';
import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useCharacterLookup } from '../hooks/useCharacterLookup';
import { CharacterHeader } from './CharacterHeader';
import { CharacterSearchInput, Divider, SecondaryButton } from './ui';
import {
  playerRolesToStringArray,
  roleStringsToPlayerFields,
  computeToggledRoles,
  getPrimaryRole,
  MAIN_SPEC_BUTTONS,
  OFFSPEC_BUTTONS,
  UTILITY_BUTTONS,
  type RoleButtonDef,
} from '../lib/roles';
import type { RaiderioCharacterResult } from '../services/raiderioService';

const ROLE_COLOR_MAP: Record<string, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  ranged: 'var(--color-dps)',
  melee: 'var(--color-dps)',
  unassigned: 'var(--text-secondary)',
};

interface PlayerCardProps {
  player: WoWPlayer;
  className?: string;
}

export function PlayerCard({ player, className = '' }: PlayerCardProps) {
  const sittingOut = useAppStore((s) => s.channelData?.sittingOut) ?? [];
  const service = useSessionService();

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [inGameName, setInGameName] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const { lookup, loading: lookupLoading } = useCharacterLookup();

  // Auto-save timer ref
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rolesRef = useRef<Set<string>>(new Set());
  const nameRef = useRef<string>('');

  const playerId = player.discordId ?? null;

  // Sync state when player changes
  useEffect(() => {
    const roles = new Set(playerRolesToStringArray(player));
    setSelectedRoles(roles);
    rolesRef.current = roles;
    setInGameName(player.inGameName ?? '');
    nameRef.current = player.inGameName ?? '';
    // Try to use existing media URL from player data
    setMediaUrl((player as Record<string, unknown>).mediaUrl as string | null ?? null);
  }, [playerId, player]);

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
        console.error('[Wheelson] Auto-save failed:', err);
      }
    }, 500);
  }, [player.discordId, player.name, service]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
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
    autoSave(rolesRef.current, value);
  }, [autoSave]);

  const handleCharacterSelect = useCallback(async (result: RaiderioCharacterResult) => {
    if (lookupLoading || !player.discordId) return;

    const character = await lookup(result.name, result.realmSlug, result.region);
    if (character) {
      setInGameName(character.name);
      nameRef.current = character.name;
      if (character.mediaUrl) setMediaUrl(character.mediaUrl);

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
        await service.saveRoles(player.discordId, player.name, roles, character.name);
      } else {
        await service.saveRoles(player.discordId, player.name, Array.from(selectedRoles), character.name);
      }

      await service.saveLinkedCharacter(player.discordId, {
        name: result.name,
        realm: result.realmSlug,
        region: result.region,
      });
    }
  }, [lookupLoading, player, lookup, selectedRoles, service]);

  const isSittingOut = player.discordId ? sittingOut.includes(player.discordId) : false;
  const primaryRole = getPrimaryRole(player);
  const color = ROLE_COLOR_MAP[primaryRole] ?? ROLE_COLOR_MAP.unassigned;

  // Compute class name from in-game name or character lookup
  const classSubtitle = player.inGameName || undefined;

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
            >
              {btnDef.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`player-card ${className}`} data-testid="player-card">
      <CharacterHeader
        name={player.name}
        subtitle={classSubtitle}
        color={color}
        imageUrl={mediaUrl}
      />

      <Divider />

      <div className="player-card__form">
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
      </div>
    </div>
  );
}
