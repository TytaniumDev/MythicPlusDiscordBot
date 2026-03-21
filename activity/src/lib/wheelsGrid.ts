import { Wheel } from './wheel';
import { WheelEntry } from '../types';

/** Media query that determines carousel vs grid mode */
const CAROUSEL_MQ = window.matchMedia('(max-width: 599px)');

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

export class WheelsGrid {
  readonly tank: Wheel;
  readonly healer: Wheel;
  readonly dps1: Wheel;
  readonly dps2: Wheel;
  readonly dps3: Wheel;

  /** Cached ordered array of all 5 wheels (tank, healer, dps1-3) */
  readonly wheels: readonly Wheel[];
  public initialized = false;

  private areaEl: HTMLDivElement;
  private containerEl: HTMLDivElement;
  private dotsEl: HTMLDivElement;
  private dots: HTMLButtonElement[] = [];
  private carouselIndex = 0;
  private _isAnimating = false;

  constructor(parent: HTMLElement) {
    // Build the .wheels-area container
    this.areaEl = document.createElement('div');
    this.areaEl.className = 'wheels-area';

    // Build the .wheels-container (grid/carousel)
    this.containerEl = document.createElement('div');
    this.containerEl.className = 'wheels-container';
    this.containerEl.style.setProperty('--carousel-index', '0');

    // Create the 5 wheels
    this.tank = new Wheel({ role: 'tank', label: 'Tank', labelClass: 'tank', ariaLabel: 'Tank Selection Wheel' });
    this.healer = new Wheel({ role: 'healer', label: 'Healer', labelClass: 'healer', ariaLabel: 'Healer Selection Wheel' });
    this.dps1 = new Wheel({ role: 'dps1', label: 'DPS', labelClass: 'dps', ariaLabel: 'DPS Selection Wheel 1' });
    this.dps2 = new Wheel({ role: 'dps2', label: 'DPS', labelClass: 'dps', ariaLabel: 'DPS Selection Wheel 2' });
    this.dps3 = new Wheel({ role: 'dps3', label: 'DPS', labelClass: 'dps', ariaLabel: 'DPS Selection Wheel 3' });

    this.wheels = [this.tank, this.healer, this.dps1, this.dps2, this.dps3];

    // Mount wheel slots into the container
    this.containerEl.appendChild(this.tank.element);
    this.containerEl.appendChild(this.healer.element);
    this.containerEl.appendChild(this.dps1.element);
    this.containerEl.appendChild(this.dps2.element);
    this.containerEl.appendChild(this.dps3.element);

    this.areaEl.appendChild(this.containerEl);

    // Build carousel dots
    this.dotsEl = document.createElement('div');
    this.dotsEl.className = 'carousel-dots';
    this.dotsEl.setAttribute('aria-label', 'Wheel navigation');

    DOT_CONFIGS.forEach((cfg, i) => {
      const dot = document.createElement('button');
      dot.className = 'carousel-dot';
      if (i === 0) {
        dot.classList.add('active');
        dot.setAttribute('aria-current', 'step');
      }
      dot.dataset.index = String(i);
      dot.setAttribute('aria-label', cfg.ariaLabel);
      dot.style.setProperty('--dot-color', cfg.dotColor);

      dot.addEventListener('click', () => {
        if (this._isAnimating) return;
        this.setCarouselSlide(i);
      });

      this.dots.push(dot);
      this.dotsEl.appendChild(dot);
    });

    this.areaEl.appendChild(this.dotsEl);

    // Touch swipe support for carousel
    let touchStartX = 0;
    let touchStartY = 0;

    this.containerEl.addEventListener('touchstart', (e) => {
      if (!this.isCarouselMode() || this._isAnimating) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });

    this.containerEl.addEventListener('touchend', (e) => {
      if (!this.isCarouselMode() || this._isAnimating) return;
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      // Only handle horizontal swipes (ignore vertical scrolling)
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        const maxIndex = this.dots.length - 1;
        if (dx < 0 && this.carouselIndex < maxIndex) {
          this.setCarouselSlide(this.carouselIndex + 1);
        } else if (dx > 0 && this.carouselIndex > 0) {
          this.setCarouselSlide(this.carouselIndex - 1);
        }
      }
    }, { passive: true });

    // Mount the whole area into the parent
    parent.appendChild(this.areaEl);
  }

  /** Check if we're in mobile carousel mode */
  isCarouselMode(): boolean {
    return CAROUSEL_MQ.matches;
  }

  /** Animation lock — gates dot clicks, swipes, and spin requests */
  get isAnimating(): boolean {
    return this._isAnimating;
  }

  set isAnimating(value: boolean) {
    this._isAnimating = value;
  }

  /** Initialize all 5 wheels with candidate pools */
  initWheels(pools: { tanks: WheelEntry[]; healers: WheelEntry[]; dps: WheelEntry[] }) {
    this.tank.init(pools.tanks);
    this.healer.init(pools.healers);
    this.dps1.init(pools.dps);
    this.dps2.init(pools.dps);
    this.dps3.init(pools.dps);
    this.initialized = true;
  }

  /** Update all 5 wheels with candidate pools without resetting rotation */
  updatePools(pools: { tanks: WheelEntry[]; healers: WheelEntry[]; dps: WheelEntry[] }) {
    this.tank.updateEntries(pools.tanks);
    this.healer.updateEntries(pools.healers);
    this.dps1.updateEntries(pools.dps);
    this.dps2.updateEntries(pools.dps);
    this.dps3.updateEntries(pools.dps);
  }

  /** Force a redraw of all wheels (call after layout transitions) */
  forceRedraw() {
    this.tank.forceRedraw();
    this.healer.forceRedraw();
    this.dps1.forceRedraw();
    this.dps2.forceRedraw();
    this.dps3.forceRedraw();
  }

  /** Cancel all spinning wheels */
  cancelAll() {
    this.tank.cancel();
    this.healer.cancel();
    this.dps1.cancel();
    this.dps2.cancel();
    this.dps3.cancel();
  }

  /** Clear all result text */
  clearAllResults() {
    this.tank.clearResult();
    this.healer.clearResult();
    this.dps1.clearResult();
    this.dps2.clearResult();
    this.dps3.clearResult();
  }

  /** Remove spinning class from all wheel slots */
  clearSpinningState() {
    this.allSlots().forEach((el) => el.classList.remove('spinning'));
  }

  /** Add spinning class to all wheel slots */
  setAllSpinning() {
    this.allSlots().forEach((el) => el.classList.add('spinning'));
  }

  /** Get a wheel slot element by index */
  getSlot(index: number): HTMLElement | undefined {
    return this.allSlots()[index];
  }

  /** Navigate to a carousel slide */
  setCarouselSlide(index: number) {
    this.carouselIndex = Math.max(0, Math.min(this.dots.length - 1, index));
    this.containerEl.style.setProperty('--carousel-index', String(this.carouselIndex));

    this.dots.forEach((dot, i) => {
      const isActive = i === this.carouselIndex;
      dot.classList.toggle('active', isActive);
      if (isActive) {
        dot.setAttribute('aria-current', 'step');
      } else {
        dot.removeAttribute('aria-current');
      }
    });

    // Force redraw of all wheels — the canvas may have had zero dimensions
    // while off-screen during carousel transitions.
    requestAnimationFrame(() => this.forceRedraw());
  }

  /** Mark a carousel dot as completed */
  markDotCompleted(index: number) {
    this.dots[index]?.classList.add('completed');
  }

  /** Reset all carousel dots to initial state */
  resetCarouselDots() {
    this.dots.forEach((dot) => {
      dot.classList.remove('completed', 'active');
      dot.removeAttribute('aria-current');
    });
    const firstDot = this.dots[0];
    firstDot?.classList.add('active');
    firstDot?.setAttribute('aria-current', 'step');
  }

  /** Get the ordered array of wheels for spin sequences */
  orderedWheels(): readonly Wheel[] {
    return this.wheels;
  }

  private allSlots(): HTMLElement[] {
    return this.wheels.map((w) => w.element);
  }
}
