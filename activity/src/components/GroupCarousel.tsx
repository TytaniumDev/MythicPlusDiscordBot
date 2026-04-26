import { useEffect, useRef } from 'react';
import { GroupSlide } from './GroupSlide';
import type { WoWGroup } from '../types';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';

function ArrowChevron({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {direction === 'left' ? (
        <polyline points="15 18 9 12 15 6" />
      ) : (
        <polyline points="9 18 15 12 9 6" />
      )}
    </svg>
  );
}

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
  const viewportRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;

  const clamped = Math.max(0, Math.min(activeIndex, items.length - 1));
  const single = items.length === 1;

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || single) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== el) return;
      if (e.key === 'ArrowLeft' && clamped > 0) {
        e.preventDefault();
        onActiveIndexChange(clamped - 1);
      } else if (e.key === 'ArrowRight' && clamped < items.length - 1) {
        e.preventDefault();
        onActiveIndexChange(clamped + 1);
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [clamped, items.length, onActiveIndexChange, single]);

  return (
    <div
      className={`group-carousel${single ? ' group-carousel--single' : ''}`}
      data-testid="group-carousel"
    >
      <div
        className="group-carousel__viewport"
        ref={viewportRef}
        tabIndex={single ? -1 : 0}
      >
        <div
          className="group-carousel__track"
          style={{
            transform: `translateX(calc(50% - ${clamped} * var(--group-carousel-slide-width) - var(--group-carousel-slide-width) / 2))`,
          }}
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
      {!single && (
        <>
          <button
            type="button"
            className="group-carousel__arrow group-carousel__arrow--prev"
            aria-label="Previous group"
            onClick={() => onActiveIndexChange(clamped - 1)}
            disabled={clamped === 0}
          >
            <ArrowChevron direction="left" />
          </button>
          <button
            type="button"
            className="group-carousel__arrow group-carousel__arrow--next"
            aria-label="Next group"
            onClick={() => onActiveIndexChange(clamped + 1)}
            disabled={clamped === items.length - 1}
          >
            <ArrowChevron direction="right" />
          </button>
        </>
      )}
      <div className="group-carousel__live" aria-live="polite" aria-atomic="true">
        Group {clamped + 1} of {items.length}
      </div>
    </div>
  );
}
