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
export const RESULTS_PAUSE = 300;             // ms after the last group before the results screen

// Synced reveal (lib/revealTimeline.ts)
export const REVEAL_LEAD_MS = 1500;           // ms between pressing Spin and the reveal starting on every screen
export const MIN_CATCH_UP_SPIN = 600;         // ms; a late client's wheels spin at least this long

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Resolve at `time` (ms since the epoch), or right away if it has passed. */
export function delayUntil(time: number, now: number = Date.now()): Promise<void> {
  return delay(Math.max(0, time - now));
}
