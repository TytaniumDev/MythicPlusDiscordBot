import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Wheel, type WheelHandle } from './Wheel';
import type { WheelEntry } from '../types';
import { useIsCarouselMode } from '../hooks/useMediaQuery';

interface WheelsGridProps {
  pools?: { tanks: WheelEntry[]; healers: WheelEntry[]; dps: WheelEntry[] } | null;
}

export interface WheelsGridHandle {
  /** Per-wheel handles for direct spin calls. */
  readonly tank: WheelHandle;
  readonly healer: WheelHandle;
  readonly dps1: WheelHandle;
  readonly dps2: WheelHandle;
  readonly dps3: WheelHandle;
  /** All 5 wheels in render order (tank, healer, dps1-3). */
  orderedWheels(): readonly WheelHandle[];
  /** Reset all wheels with fresh pools. */
  initWheels(pools: { tanks: WheelEntry[]; healers: WheelEntry[]; dps: WheelEntry[] }): void;
  /** Clear result text + portrait for every wheel. */
  clearAllResults(): void;
  /** Cancel all in-flight spin animations. */
  cancelAll(): void;
  /** Toggle the pulse-glow state on every wheel. */
  setAllSpinning(value: boolean): void;
  /** True if the viewport is currently in carousel (narrow) layout. */
  isCarouselMode(): boolean;
  /** Scroll the carousel to a specific wheel + update dot states. */
  setCarouselSlide(index: number): void;
  /** Mark a carousel dot as completed (e.g., after landing a wheel). */
  markDotCompleted(index: number): void;
  /** Reset carousel dots to initial (slide 0 active, no completions). */
  resetCarouselDots(): void;
}

/**
 * Kept for backwards compatibility with WheelsView (which holds a
 * `useRef<WheelsGridRef>` and accesses `.current.grid`).
 */
export interface WheelsGridRef {
  grid: WheelsGridHandle | null;
}

interface DotConfig {
  ariaLabel: string;
  dotColor: string;
}

const DOT_CONFIGS: DotConfig[] = [
  { ariaLabel: 'Tank wheel', dotColor: 'var(--color-tank)' },
  { ariaLabel: 'Healer wheel', dotColor: 'var(--color-healer)' },
  { ariaLabel: 'DPS 1 wheel', dotColor: 'var(--color-dps)' },
  { ariaLabel: 'DPS 2 wheel', dotColor: 'var(--color-dps)' },
  { ariaLabel: 'DPS 3 wheel', dotColor: 'var(--color-dps)' },
];

const CAROUSEL_MQ =
  typeof window !== 'undefined' ? window.matchMedia('(max-width: 599px)') : null;

export const WheelsGridComponent = forwardRef<WheelsGridRef, WheelsGridProps>(
  function WheelsGridComponent({ pools }, ref) {
    const tankRef = useRef<WheelHandle>(null);
    const healerRef = useRef<WheelHandle>(null);
    const dps1Ref = useRef<WheelHandle>(null);
    const dps2Ref = useRef<WheelHandle>(null);
    const dps3Ref = useRef<WheelHandle>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [carouselIndex, setCarouselIndex] = useState(0);
    const [completedDots, setCompletedDots] = useState<ReadonlySet<number>>(new Set());
    const isCarousel = useIsCarouselMode();
    const isCarouselRef = useRef(isCarousel);
    isCarouselRef.current = isCarousel;

    const wheelRefs = useMemo(
      () => [tankRef, healerRef, dps1Ref, dps2Ref, dps3Ref],
      [],
    );

    const orderedHandles = useCallback((): readonly WheelHandle[] => {
      // Force non-null: after mount, every child's ref is populated. Callers
      // should not invoke this before the grid is mounted (WheelsView gates
      // on gridRef.current?.grid existing).
      return wheelRefs.map((r) => r.current!).filter(Boolean);
    }, [wheelRefs]);

    const handle = useMemo<WheelsGridHandle>(
      () => ({
        get tank() { return tankRef.current!; },
        get healer() { return healerRef.current!; },
        get dps1() { return dps1Ref.current!; },
        get dps2() { return dps2Ref.current!; },
        get dps3() { return dps3Ref.current!; },
        orderedWheels: orderedHandles,
        initWheels(next) {
          tankRef.current?.init(next.tanks);
          healerRef.current?.init(next.healers);
          dps1Ref.current?.init(next.dps);
          dps2Ref.current?.init(next.dps);
          dps3Ref.current?.init(next.dps);
        },
        clearAllResults() {
          orderedHandles().forEach((w) => w.clearResult());
        },
        cancelAll() {
          orderedHandles().forEach((w) => w.cancel());
        },
        setAllSpinning(value) {
          orderedHandles().forEach((w) => w.setSpinning(value));
        },
        isCarouselMode() {
          return CAROUSEL_MQ?.matches ?? false;
        },
        setCarouselSlide(index) {
          const clamped = Math.max(0, Math.min(DOT_CONFIGS.length - 1, index));
          setCarouselIndex(clamped);
          const wheel = wheelRefs[clamped]?.current;
          wheel?.element?.scrollIntoView({
            behavior: 'smooth',
            inline: 'center',
            block: 'nearest',
          });
        },
        markDotCompleted(index) {
          setCompletedDots((prev) => {
            if (prev.has(index)) return prev;
            const next = new Set(prev);
            next.add(index);
            return next;
          });
        },
        resetCarouselDots() {
          setCompletedDots(new Set());
          setCarouselIndex(0);
        },
      }),
      [orderedHandles, wheelRefs],
    );

    useImperativeHandle(ref, () => ({ grid: handle }), [handle]);

    // Initialize wheels when pools change (without resetting rotation/result).
    const initializedRef = useRef(false);
    useEffect(() => {
      if (!pools) return;
      if (!initializedRef.current) {
        handle.initWheels(pools);
        initializedRef.current = true;
      } else {
        tankRef.current?.updateEntries(pools.tanks);
        healerRef.current?.updateEntries(pools.healers);
        dps1Ref.current?.updateEntries(pools.dps);
        dps2Ref.current?.updateEntries(pools.dps);
        dps3Ref.current?.updateEntries(pools.dps);
      }
    }, [pools, handle]);

    // Touch swipe support for carousel mode.
    const touchStartRef = useRef({ x: 0, y: 0 });
    const onTouchStart = useCallback((e: React.TouchEvent) => {
      if (!isCarouselRef.current) return;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };
    }, []);
    const onTouchEnd = useCallback(
      (e: React.TouchEvent) => {
        if (!isCarouselRef.current) return;
        const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
        const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
          const maxIndex = DOT_CONFIGS.length - 1;
          if (dx < 0 && carouselIndex < maxIndex) {
            handle.setCarouselSlide(carouselIndex + 1);
          } else if (dx > 0 && carouselIndex > 0) {
            handle.setCarouselSlide(carouselIndex - 1);
          }
        }
      },
      [carouselIndex, handle],
    );

    return (
      <div id="wheels-area" className="wheels-area wheels-content-area">
        <div
          ref={containerRef}
          className="wheels-container"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <Wheel
            ref={tankRef}
            role="tank"
            label="Tank"
            labelClass="tank"
            ariaLabel="Tank Selection Wheel"
          />
          <Wheel
            ref={healerRef}
            role="healer"
            label="Healer"
            labelClass="healer"
            ariaLabel="Healer Selection Wheel"
          />
          <Wheel
            ref={dps1Ref}
            role="dps1"
            label="DPS"
            labelClass="dps"
            ariaLabel="DPS Selection Wheel 1"
          />
          <Wheel
            ref={dps2Ref}
            role="dps2"
            label="DPS"
            labelClass="dps"
            ariaLabel="DPS Selection Wheel 2"
          />
          <Wheel
            ref={dps3Ref}
            role="dps3"
            label="DPS"
            labelClass="dps"
            ariaLabel="DPS Selection Wheel 3"
          />
        </div>
        <div className="carousel-dots" aria-label="Wheel navigation">
          {DOT_CONFIGS.map((cfg, i) => {
            const isActive = i === carouselIndex;
            const isDone = completedDots.has(i);
            return (
              <button
                key={i}
                type="button"
                className={`carousel-dot${isActive ? ' active' : ''}${isDone ? ' completed' : ''}`}
                aria-label={cfg.ariaLabel}
                aria-current={isActive ? 'step' : undefined}
                data-index={i}
                style={{ '--dot-color': cfg.dotColor } as React.CSSProperties}
                onClick={() => handle.setCarouselSlide(i)}
              />
            );
          })}
        </div>
      </div>
    );
  },
);
