import { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import {
  playerRolesToStringArray,
  getPrimaryRole,
  formatRoleName,
  MAIN_SPEC_BUTTONS,
  OFFSPEC_BUTTONS,
  UTILITY_BUTTONS,
  type RoleButtonDef,
} from '../lib/roles';

interface PlayerModalProps {
  players: WoWPlayer[];
}

export function PlayerModal({ players }: PlayerModalProps) {
  const modalPlayer = useAppStore((s) => s.modalPlayer);
  const service = useSessionService();

  // Resolve live player data from the players array (in case it updated since modal opened)
  const player = modalPlayer
    ? players.find((p) => p.discordId === modalPlayer.discordId) ?? modalPlayer
    : null;

  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());
  const [inGameName, setInGameName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveText, setSaveText] = useState('Save');

  // Sync state when modal opens or target player changes
  const playerId = player?.discordId ?? null;
  useEffect(() => {
    if (player) {
      setSelectedRoles(new Set(playerRolesToStringArray(player)));
      setInGameName(player.inGameName ?? '');
      setSaving(false);
      setSaveText('Save');
    }
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on Escape
  useEffect(() => {
    if (!modalPlayer) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        useAppStore.getState().setModalPlayer(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [modalPlayer]);

  const close = useCallback(() => {
    useAppStore.getState().setModalPlayer(null);
  }, []);

  const toggleRole = useCallback((btnDef: RoleButtonDef, mutuallyExclusive: boolean) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(btnDef.id)) {
        next.delete(btnDef.id);
      } else {
        if (mutuallyExclusive) {
          const groupIds = MAIN_SPEC_BUTTONS.map((b) => b.id);
          groupIds.forEach((id) => next.delete(id));
        }
        next.add(btnDef.id);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || !player?.discordId) return;
    setSaving(true);
    setSaveText('Saving...');

    try {
      await service.saveRoles(player.discordId, player.name, Array.from(selectedRoles), inGameName);
      // Set identity to this player
      const store = useAppStore.getState();
      store.setIdentity(player.discordId, player.name);
      store.setIdentityResolved(true);
      const guildId = store.currentGuildId;
      localStorage.setItem(`wheelson-player-${guildId ?? 'unknown'}`, player.discordId);

      setSaveText('Saved!');
      setTimeout(() => {
        useAppStore.getState().setModalPlayer(null);
      }, 800);
    } catch (err) {
      console.error('[Wheelson] Failed to save roles:', err);
      setSaveText('Error');
      setTimeout(() => {
        setSaveText('Save');
        setSaving(false);
      }, 2000);
    }
  }, [saving, player, selectedRoles, inGameName, service]);

  if (!modalPlayer || !player) return null;

  const roleKey = getPrimaryRole(player);
  const roleName = formatRoleName(roleKey);

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

  const modal = (
    <div className="player-modal-backdrop" onClick={close}>
      <div
        className="player-modal"
        id="player-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${player.name} roles`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="player-modal-close" onClick={close} aria-label="Close">
          &times;
        </button>

        <div className="player-modal-header">
          <span
            className={`role-dot ${roleKey}`}
            role="img"
            aria-label={roleName}
            title={roleName}
          />
          <h3>{player.name}</h3>
        </div>

        <div className="role-editor-section">
          <div className="role-editor-label">In-Game Name (optional)</div>
          <div className="role-editor-row">
            <input
              type="text"
              className="role-editor-input"
              placeholder="PlayerName-ServerName"
              value={inGameName}
              onChange={(e) => setInGameName(e.target.value)}
              maxLength={50}
            />
          </div>
        </div>

        {renderSection('Main Spec (pick one)', MAIN_SPEC_BUTTONS, true)}
        {renderSection('Offspec', OFFSPEC_BUTTONS, false)}
        {renderSection('Utilities', UTILITY_BUTTONS, false)}

        <div className="role-editor-actions">
          <button
            className="btn btn-success role-editor-save"
            disabled={saving}
            onClick={handleSave}
          >
            {saveText}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
