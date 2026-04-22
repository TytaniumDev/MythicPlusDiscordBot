import { useState } from 'react';
import { WoWGroup } from '../types';
import { useAppStore } from '../store/store';
import { utilityIcons } from '../lib/roles';
import { RoleRow } from './ui';
import { generateInviteCommand } from '@mythicplus/shared';

interface GroupCardProps {
  group: WoWGroup;
  index: number;
  label?: string;
  hideEmpty?: boolean;
  compact?: boolean;
}

async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
  }
}

export function GroupCard({ group, index, label, hideEmpty = false, compact = false }: GroupCardProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);

  const allPlayers = [group.tank, group.healer, ...group.dps];
  const isMyGroup = currentPlayerId != null && allPlayers.some((p) => p?.discordId === currentPlayerId);

  const cardClass = compact ? 'group-card-compact' : 'group-card';
  const heading = label ?? `Group ${index + 1}`;

  // Exclude the current user so anyone in the group can be the inviter
  const inviteCmd = generateInviteCommand(group, currentPlayerId ?? undefined);
  const hasInvite = inviteCmd.length > 0;

  const [copied, setCopied] = useState(false);

  const handleCopyInvite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await copyToClipboard(inviteCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`${cardClass}${isMyGroup ? ' is-my-group' : ''}`}
    >
      <h4>{heading}</h4>
      {(!hideEmpty || group.tank) && (
        <RoleRow
          color="var(--color-tank)"
          roleLabel="Tank"
          name={group.tank?.name || 'None'}
          suffix={utilityIcons(group.tank)}
          isOffspec={group.tank ? group.tank.mainRole !== 'tank' : false}
          compact={compact}
        />
      )}
      {(!hideEmpty || group.healer) && (
        <RoleRow
          color="var(--color-healer)"
          roleLabel="Healer"
          name={group.healer?.name || 'None'}
          suffix={utilityIcons(group.healer)}
          isOffspec={group.healer ? group.healer.mainRole !== 'healer' : false}
          compact={compact}
        />
      )}
      {group.dps.map((d) => (
        <RoleRow
          key={d.discordId || d.name}
          color="var(--color-dps)"
          roleLabel="DPS"
          name={d.name}
          suffix={utilityIcons(d)}
          isOffspec={d.mainRole !== null && d.mainRole !== 'ranged' && d.mainRole !== 'melee'}
          compact={compact}
        />
      ))}
      {hasInvite && !compact && (
        <button
          type="button"
          className="btn-copy-invite"
          onClick={handleCopyInvite}
          aria-label={`Copy invite command for ${heading}`}
        >
          {copied ? 'Copied!' : 'Copy Invite'}
        </button>
      )}
    </div>
  );
}
