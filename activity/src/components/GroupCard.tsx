import { WoWGroup, WoWPlayer } from '../types';
import { utilityIcons } from '../lib/roles';

interface GroupCardProps {
  group: WoWGroup;
  index: number;
  label?: string;
  hideEmpty?: boolean;
  compact?: boolean;
}

function RoleRow({ color, roleLabel, name, player, isOffspec, compact }: {
  color: string;
  roleLabel: string;
  name: string;
  player?: WoWPlayer | null;
  isOffspec?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'compact-role' : 'group-role'}>
      <span
        className={`role-indicator ${roleLabel.toLowerCase()}${isOffspec ? ' offspec' : ''}`}
        style={isOffspec ? { borderColor: color } : { background: color }}
        role="img"
        aria-label={`${roleLabel}${isOffspec ? ' (offspec)' : ''}`}
        title={`${roleLabel}${isOffspec ? ' (offspec)' : ''}`}
      />
      {!compact && <span className="role-label">{roleLabel}</span>}
      <span className="role-name">{name}{utilityIcons(player)}</span>
    </div>
  );
}

export function GroupCard({ group, index, label, hideEmpty = false, compact = false }: GroupCardProps) {
  const cardClass = compact ? 'group-card-compact' : 'group-card';
  const heading = label ?? `Group ${index + 1}`;

  return (
    <div className={cardClass}>
      <h4>{heading}</h4>
      {(!hideEmpty || group.tank) && (
        <RoleRow
          color="var(--color-tank)"
          roleLabel="Tank"
          name={group.tank?.name || 'None'}
          player={group.tank}
          isOffspec={group.tank ? group.tank.mainRole !== 'tank' : false}
          compact={compact}
        />
      )}
      {(!hideEmpty || group.healer) && (
        <RoleRow
          color="var(--color-healer)"
          roleLabel="Healer"
          name={group.healer?.name || 'None'}
          player={group.healer}
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
          player={d}
          isOffspec={d.mainRole !== null && d.mainRole !== 'ranged' && d.mainRole !== 'melee'}
          compact={compact}
        />
      ))}
    </div>
  );
}
