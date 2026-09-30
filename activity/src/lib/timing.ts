// ── Configurable Timing Constants ────────────────────────────
// Per-wheel spin durations, ordered tank → healer → dps1/2/3. All five wheels
// start together in every layout; each lands WHEEL_SPIN_STAGGER ms after the
// previous so landings are individually visible instead of clumping into a
// single pop.
export const WHEEL_SPIN_BASE_DURATION = 3000;
export const WHEEL_SPIN_STAGGER = 400;
export const WHEEL_COUNT = 5;
export const WHEEL_SPIN_DURATIONS = Array.from(
  { length: WHEEL_COUNT },
  (_, i) => WHEEL_SPIN_BASE_DURATION + i * WHEEL_SPIN_STAGGER,
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
