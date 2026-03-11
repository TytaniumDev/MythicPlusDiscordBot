import { useState } from 'react';
import { WoWGroup, WoWPlayer } from '../types';
import { utilityIcons } from '../lib/roles';
import { generateInviteCommand } from '@mythicplus/shared';

interface GroupCardProps {
  group: WoWGroup;
  index: number;
  label?: string;
  hideEmpty?: boolean;
  compact?: boolean;
}

function RoleRow({ color, roleLabel, name, player }: {
  color: string;
  roleLabel: string;
  name: string;
  player?: WoWPlayer | null;
}) {
  return (
    <div className="group-role">
      <span
        className={`role-indicator ${roleLabel.toLowerCase()}`}
        style={{ background: color }}
        role="img"
        aria-label={roleLabel}
        title={roleLabel}
      />
      <span className="role-label">{roleLabel}</span>
      <span className="role-name">{name}{utilityIcons(player)}</span>
    </div>
  );
}

function CompactRoleRow({ color, roleLabel, name, player }: {
  color: string;
  roleLabel: string;
  name: string;
  player?: WoWPlayer | null;
}) {
  return (
    <div className="compact-role">
      <span
        className={`role-indicator ${roleLabel.toLowerCase()}`}
        style={{ background: color }}
        role="img"
        aria-label={roleLabel}
        title={roleLabel}
      />
      <span className="role-name">{name}{utilityIcons(player)}</span>
    </div>
  );
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
  const cardClass = compact ? 'group-card-compact' : 'group-card';
  const Row = compact ? CompactRoleRow : RoleRow;
  const heading = label ?? `Group ${index + 1}`;

  const inviteCmd = generateInviteCommand(group);
  const isClickable = inviteCmd.length > 0;

  const [copied, setCopied] = useState(false);

  const handleCopyInvite = async () => {
    if (!isClickable) return;
    await copyToClipboard(inviteCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`${cardClass}${isClickable ? ' group-card-clickable' : ''}`}
      onClick={isClickable ? handleCopyInvite : undefined}
      title={isClickable ? 'Click to copy invite command' : undefined}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleCopyInvite(); } : undefined}
    >
      <h4>
        {heading}
        {copied && <span className="copy-toast">Copied!</span>}
      </h4>
      {(!hideEmpty || group.tank) && (
        <Row
          color="var(--color-tank)"
          roleLabel="Tank"
          name={group.tank?.name || 'None'}
          player={group.tank}
        />
      )}
      {(!hideEmpty || group.healer) && (
        <Row
          color="var(--color-healer)"
          roleLabel="Healer"
          name={group.healer?.name || 'None'}
          player={group.healer}
        />
      )}
      {group.dps.map((d, i) => (
        <Row
          key={i}
          color="var(--color-dps)"
          roleLabel="DPS"
          name={d.name}
          player={d}
        />
      ))}
    </div>
  );
}
