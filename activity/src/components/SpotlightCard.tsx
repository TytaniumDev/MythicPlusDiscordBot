import { WoWGroup, WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { utilityIcons } from '../lib/roles';

interface SpotlightCardProps {
  group: WoWGroup;
  index: number;
  visible: boolean;
  exit?: boolean;
  label?: string;
}

function SpotlightRoleRow({ color, roleLabel, name, player, isOffspec }: {
  color: string;
  roleLabel: string;
  name: string;
  player?: WoWPlayer | null;
  isOffspec?: boolean;
}) {
  return (
    <div className="spotlight-role">
      <span
        className={`role-indicator ${roleLabel.toLowerCase()}${isOffspec ? ' offspec' : ''}`}
        style={isOffspec ? { borderColor: color } : { background: color }}
        role="img"
        aria-label={`${roleLabel}${isOffspec ? ' (offspec)' : ''}`}
        title={`${roleLabel}${isOffspec ? ' (offspec)' : ''}`}
      />
      <span className="role-label">{roleLabel}</span>
      <span className="role-name">{name}{utilityIcons(player)}</span>
    </div>
  );
}

export function SpotlightCard({ group, index, visible, exit = false, label }: SpotlightCardProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const allPlayers = [group.tank, group.healer, ...group.dps];
  const isMyGroup = currentPlayerId != null && allPlayers.some((p) => p?.discordId === currentPlayerId);

  return (
    <div className={`spotlight-card${visible ? ' spotlight-visible' : ''}${exit ? ' spotlight-exit' : ''}${isMyGroup ? ' is-my-group' : ''}`}>
      <h3 className="spotlight-heading">
        {label ?? (isMyGroup ? `Group ${index + 1} — Your Group!` : `Group ${index + 1}`)}
      </h3>
      {group.tank && (
        <SpotlightRoleRow color="var(--color-tank)" roleLabel="Tank" name={group.tank.name} player={group.tank} isOffspec={group.tank.mainRole !== 'tank'} />
      )}
      {group.healer && (
        <SpotlightRoleRow color="var(--color-healer)" roleLabel="Healer" name={group.healer.name} player={group.healer} isOffspec={group.healer.mainRole !== 'healer'} />
      )}
      {group.dps.map((d) => (
        <SpotlightRoleRow key={d.discordId || d.name} color="var(--color-dps)" roleLabel="DPS" name={d.name} player={d} isOffspec={d.mainRole !== null && d.mainRole !== 'ranged' && d.mainRole !== 'melee'} />
      ))}
    </div>
  );
}
