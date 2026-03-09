import { useState, useCallback } from 'react';
import { WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import {
  playerRolesToStringArray,
  MAIN_SPEC_BUTTONS,
  OFFSPEC_BUTTONS,
  UTILITY_BUTTONS,
  type RoleButtonDef,
} from '../lib/roles';

interface RoleEditorProps {
  players: WoWPlayer[];
}

export function RoleEditor({ players }: RoleEditorProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const roleEditorVisible = useAppStore((s) => s.roleEditorVisible);
  const service = useSessionService();

  const player = players.find((p) => p.discordId === currentPlayerId);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    new Set(player ? playerRolesToStringArray(player) : []),
  );
  const [saving, setSaving] = useState(false);
  const [saveText, setSaveText] = useState('Save');

  // Sync selected roles when player changes
  const playerRolesKey = player ? playerRolesToStringArray(player).sort().join(',') : '';
  const [lastPlayerKey, setLastPlayerKey] = useState(playerRolesKey);
  if (playerRolesKey !== lastPlayerKey) {
    setLastPlayerKey(playerRolesKey);
    setSelectedRoles(new Set(player ? playerRolesToStringArray(player) : []));
  }

  const toggleRole = useCallback((btnDef: RoleButtonDef, mutuallyExclusive: boolean) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(btnDef.id)) {
        next.delete(btnDef.id);
      } else {
        if (mutuallyExclusive) {
          // Get all IDs in the same group
          const groupIds = MAIN_SPEC_BUTTONS.map((b) => b.id);
          groupIds.forEach((id) => next.delete(id));
        }
        next.add(btnDef.id);
      }
      return next;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (saving || !currentPlayerId) return;
    setSaving(true);
    setSaveText('Saving...');

    try {
      await service.saveRoles(currentPlayerId, currentPlayerName ?? '', Array.from(selectedRoles));
      setSaveText('Saved!');
      setTimeout(() => {
        setSaveText('Save');
        setSaving(false);
        useAppStore.getState().setRoleEditorVisible(false);
        useAppStore.getState().setRoleEditorManuallyToggled(false);
      }, 1500);
    } catch (err) {
      console.error('[Wheelson] Failed to save roles:', err);
      setSaveText('Error');
      setTimeout(() => {
        setSaveText('Save');
        setSaving(false);
      }, 2000);
    }
  }, [saving, currentPlayerId, currentPlayerName, selectedRoles, service]);

  if (!currentPlayerId || !roleEditorVisible) {
    return <div id="role-editor" className="hidden" />;
  }

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
    <div id="role-editor" className="role-editor">
      <div className="role-editor-title">Your Roles</div>
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
  );
}
