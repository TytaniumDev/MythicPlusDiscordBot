import { WoWGroup, WoWPlayer } from '../types';
import { useAppStore } from '../store/store';
import { utilityIcons } from '../lib/roles';
import { RoleRow } from './ui';
import { SpotlightPortraits } from './SpotlightPortraits';

interface SpotlightCardProps {
  group: WoWGroup;
  index: number;
  visible: boolean;
  exit?: boolean;
  label?: string;
}

export function SpotlightCard({ group, index, visible, exit = false, label }: SpotlightCardProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const rosterPlayers = [group.tank, group.healer, ...group.dps].filter(
    (p): p is WoWPlayer => p !== null,
  );
  const isMyGroup = currentPlayerId != null && rosterPlayers.some((p) => p.discordId === currentPlayerId);

  return (
    <div className={`spotlight-wrapper${visible ? ' spotlight-visible' : ''}${exit ? ' spotlight-exit' : ''}`}>
      <div className={`spotlight-card${isMyGroup ? ' is-my-group' : ''}`}>
        <h3 className="spotlight-heading">
          {label ?? `Group ${index + 1}`}
        </h3>
        {group.tank && (
          <RoleRow
            variant="spotlight"
            color="var(--color-tank)"
            roleLabel="Tank"
            name={group.tank.name}
            suffix={utilityIcons(group.tank)}
            isOffspec={group.tank.mainRole !== 'tank'}
          />
        )}
        {group.healer && (
          <RoleRow
            variant="spotlight"
            color="var(--color-healer)"
            roleLabel="Healer"
            name={group.healer.name}
            suffix={utilityIcons(group.healer)}
            isOffspec={group.healer.mainRole !== 'healer'}
          />
        )}
        {group.dps.map((d) => (
          <RoleRow
            key={d.discordId || d.name}
            variant="spotlight"
            color="var(--color-dps)"
            roleLabel="DPS"
            name={d.name}
            suffix={utilityIcons(d)}
            isOffspec={d.mainRole !== null && d.mainRole !== 'ranged' && d.mainRole !== 'melee'}
          />
        ))}
      </div>
      <SpotlightPortraits players={rosterPlayers} />
    </div>
  );
}
