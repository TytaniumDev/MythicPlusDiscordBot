import { useEffect, useRef } from 'react';
import { GroupSlide } from './GroupSlide';
import type { WoWGroup } from '../types';
import type { CharacterDungeonScores } from '../services/raiderioMythicPlus';

const SWIPE_THRESHOLD_PX = 40;

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
  const wrap = (i: number) => ((i % items.length) + items.length) % items.length;
  const goPrev = () => onActiveIndexChange(wrap(clamped - 1));
  const goNext = () => onActiveIndexChange(wrap(clamped + 1));

  useEffect(() => {
    const el = viewportRef.current;
    if (!el || single) return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement !== el) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onActiveIndexChange(wrap(clamped - 1));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onActiveIndexChange(wrap(clamped + 1));
      }
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
    // wrap is recreated each render but only depends on items.length, which is in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clamped, items.length, onActiveIndexChange, single]);

  const dragStartXRef = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (single) return;
    dragStartXRef.current = e.clientX;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const startX = dragStartXRef.current;
    dragStartXRef.current = null;
    if (startX == null || single) return;
    const dx = e.clientX - startX;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  return (
    <div
      className={`group-carousel${single ? ' group-carousel--single' : ''}`}
      data-testid="group-carousel"
    >
      <div
        className="group-carousel__viewport"
        ref={viewportRef}
        tabIndex={single ? -1 : 0}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => { dragStartXRef.current = null; }}
      >
        <div className="group-carousel__track">
          {items.map((item, i) => {
            const total = items.length;
            // Shortest signed distance from active for circular peek placement.
            let offset = i - clamped;
            if (total > 1) {
              if (offset > total / 2) offset -= total;
              else if (offset < -total / 2) offset += total;
            }
            const role =
              offset === 0 ? 'active' : Math.abs(offset) === 1 ? 'peek' : 'distant';
            return (
              <div
                key={item.index}
                className={`group-carousel__slide group-carousel__slide--${role}`}
                style={{
                  transform: `translateX(calc(${offset} * var(--group-carousel-slide-width)))`,
                }}
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
            onClick={goPrev}
          >
            <ArrowChevron direction="left" />
          </button>
          <button
            type="button"
            className="group-carousel__arrow group-carousel__arrow--next"
            aria-label="Next group"
            onClick={goNext}
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
