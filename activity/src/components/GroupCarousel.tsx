import { GroupSlide } from './GroupSlide';
import type { WoWGroup } from '../types';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';

export interface GroupCarouselItem {
  group: WoWGroup;
  index: number;
  label?: string;
}

export interface GroupCarouselProps {
  items: ReadonlyArray<GroupCarouselItem>;
  activeIndex: number;
  onActiveIndexChange: (next: number) => void;
  scoresByDiscordId?: ReadonlyMap<string, CharacterDungeonScores | null>;
}

export function GroupCarousel({
  items,
  activeIndex,
  onActiveIndexChange,
  scoresByDiscordId,
}: GroupCarouselProps) {
  if (items.length === 0) return null;

  const clamped = Math.max(0, Math.min(activeIndex, items.length - 1));
  const single = items.length === 1;

  return (
    <div
      className={`group-carousel${single ? ' group-carousel--single' : ''}`}
      data-testid="group-carousel"
    >
      <div className="group-carousel__viewport">
        <div
          className="group-carousel__track"
          style={{ transform: `translateX(${-clamped * 100}%)` }}
        >
          {items.map((item, i) => {
            const offset = i - clamped;
            const role =
              offset === 0 ? 'active' : Math.abs(offset) === 1 ? 'peek' : 'distant';
            return (
              <div
                key={item.index}
                className={`group-carousel__slide group-carousel__slide--${role}`}
                aria-hidden={offset !== 0}
                onClick={() => offset !== 0 && onActiveIndexChange(i)}
              >
                <GroupSlide
                  group={item.group}
                  index={item.index}
                  label={item.label}
                  scoresByDiscordId={scoresByDiscordId}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="group-carousel__live" aria-live="polite" aria-atomic="true">
        Group {clamped + 1} of {items.length}
      </div>
    </div>
  );
}
