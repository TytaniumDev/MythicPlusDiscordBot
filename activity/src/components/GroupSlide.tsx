import type { WoWGroup } from '../types';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';

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

export function GroupSlide({ group, index, label }: GroupSlideProps) {
  const heading = label ?? `Group ${index + 1}`;
  const slots = buildSlots(group);

  return (
    <div className="group-slide" data-testid={`group-slide-${index}`}>
      <h3 className="group-slide__heading">{heading}</h3>
      <div className="group-slide__grid" role="group" aria-label={heading}>
        {slots.map((slot, i) => (
          <div className="group-slide__col" key={i} data-role={slot.role}>
            {/* role-icon, utility-icon, portrait, name rows fill in later tasks */}
          </div>
        ))}
      </div>
    </div>
  );
}
