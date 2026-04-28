// ── Configurable Timing Constants ────────────────────────────
export const CAROUSEL_SPIN_DURATION = 2000;   // ms per wheel in carousel mode
export const CAROUSEL_ADVANCE_DELAY = 600;    // ms pause after each landing
// Per-wheel spin durations in grid mode, ordered tank → healer → dps1/2/3.
// Each wheel lands GRID_SPIN_STAGGER ms after the previous so landings are
// individually visible instead of clumping into a single pop.
export const GRID_SPIN_BASE_DURATION = 3000;
export const GRID_SPIN_STAGGER = 400;
export const GRID_WHEEL_COUNT = 5;
export const GRID_SPIN_DURATIONS = Array.from(
  { length: GRID_WHEEL_COUNT },
  (_, i) => GRID_SPIN_BASE_DURATION + i * GRID_SPIN_STAGGER,
);

// Auto-advance spotlight timing
export const SPOTLIGHT_HOLD_DURATION = 1500;  // ms to hold spotlight card center-stage
export const SPOTLIGHT_ENTER_DURATION = 500;  // ms for spotlight card enter animation
export const SPOTLIGHT_EXIT_DURATION = 400;   // ms for spotlight card exit animation
export const WHEELS_FADE_DURATION = 350;      // ms for wheels fade in/out
export const POST_LAND_PAUSE = 700;           // ms pause after wheels land before transitioning

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
