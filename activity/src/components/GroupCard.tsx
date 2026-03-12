import { WoWGroup, WoWPlayer } from '../types';
import { utilityIcons } from '../lib/roles';
import { useAppStore } from '../store/store';

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

export function GroupCard({ group, index, label, hideEmpty = false, compact = false }: GroupCardProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const isMyGroup = currentPlayerId && [
    group.tank?.discordId,
    group.healer?.discordId,
    ...group.dps.map((d) => d.discordId),
  ].includes(currentPlayerId);

  const cardClass = compact ? 'group-card-compact' : 'group-card';
  const Row = compact ? CompactRoleRow : RoleRow;
  const heading = label ?? `Group ${index + 1}`;

  return (
    <div className={`${cardClass}${isMyGroup ? ' is-my-group' : ''}`}>
      <h4>{heading}</h4>
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
