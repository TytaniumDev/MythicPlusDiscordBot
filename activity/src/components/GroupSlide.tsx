import type { WoWGroup, WoWPlayer } from '../types';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';
import { utilityIcons } from '../lib/roles';
import { SpotlightPortrait } from './SpotlightPortrait';

export interface GroupSlideProps {
  group: WoWGroup;
  index: number;
  label?: string;
  scoresByDiscordId?: ReadonlyMap<string, CharacterDungeonScores | null>;
}

const SLOT_COUNT = 5;

type SlotRole = 'tank' | 'healer' | 'dps';

interface Slot {
  role: SlotRole;
  // null when the group has no player in this slot (remainder case).
  player: WoWGroup['tank'];
}

const ROLE_COLOR: Record<SlotRole, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  dps: 'var(--color-dps)',
};

const ROLE_LABEL: Record<SlotRole, string> = {
  tank: 'Tank',
  healer: 'Healer',
  dps: 'DPS',
};

function isOffspecForSlot(slot: SlotRole, player: WoWPlayer | null): boolean {
  if (!player || player.mainRole == null) return false;
  if (slot === 'tank') return player.mainRole !== 'tank';
  if (slot === 'healer') return player.mainRole !== 'healer';
  // dps slot: any player whose main role is tank or healer is filling DPS as offspec.
  return player.mainRole === 'tank' || player.mainRole === 'healer';
}

function buildSlots(group: WoWGroup): Slot[] {
  const slots: Slot[] = [
    { role: 'tank', player: group.tank },
    { role: 'healer', player: group.healer },
  ];
  for (let i = 0; i < 3; i++) {
    slots.push({ role: 'dps', player: group.dps[i] ?? null });
  }
  return slots.slice(0, SLOT_COUNT);
}

export function GroupSlide({ group, index, label, scoresByDiscordId }: GroupSlideProps) {
  const heading = label ?? `Group ${index + 1}`;
  const slots = buildSlots(group);

  return (
    <div className="group-slide" data-testid={`group-slide-${index}`}>
      <h3 className="group-slide__heading">{heading}</h3>
      <div className="group-slide__grid" role="group" aria-label={heading}>
        {slots.map((slot, i) => {
          const offspec = isOffspecForSlot(slot.role, slot.player);
          const color = ROLE_COLOR[slot.role];
          const label = ROLE_LABEL[slot.role];
          const ariaLabel = slot.player ? `${label}${offspec ? ' (offspec)' : ''}` : `${label} slot empty`;

          return (
            <div className="group-slide__col" key={i} data-role={slot.role}>
              <span
                className={`group-slide__role-icon${offspec ? ' is-offspec' : ''}${slot.player ? '' : ' is-empty'}`}
                style={offspec ? { borderColor: color } : { background: color }}
                role="img"
                aria-label={ariaLabel}
                title={ariaLabel}
              />
              <span
                className="group-slide__utility-row"
                aria-label={slot.player ? utilityIcons(slot.player).trim() || 'No utilities' : 'No utilities'}
              >
                {slot.player ? utilityIcons(slot.player).trim() : ''}
              </span>
              {slot.player ? (
                <SpotlightPortrait
                  name={slot.player.name}
                  characterClass={slot.player.characterClass}
                  mediaUrl={slot.player.mediaUrl}
                  scores={
                    slot.player.discordId
                      ? scoresByDiscordId?.get(slot.player.discordId) ?? null
                      : null
                  }
                />
              ) : (
                <div className="group-slide__portrait-placeholder" aria-hidden="true">
                  <span className="group-slide__placeholder-glyph">?</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
