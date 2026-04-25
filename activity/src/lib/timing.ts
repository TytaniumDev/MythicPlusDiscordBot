// ── Configurable Timing Constants ────────────────────────────
export const CAROUSEL_SPIN_DURATION = 2000;   // ms per wheel in carousel mode
export const CAROUSEL_ADVANCE_DELAY = 400;    // ms pause after each landing
// Per-wheel spin durations in grid mode, ordered tank → healer → dps1/2/3.
// Each wheel lands 200ms after the previous so portrait reveals are
// individually visible instead of clumping into a single pop.
export const GRID_SPIN_DURATIONS = [3000, 3200, 3400, 3600, 3800];

// Portrait reveal timing — runs in parallel with audio.land() so the portrait
// finishes expanding as the "pop" sound plays. Matches the land() sound's ~200ms
// duration. Must match the `transition: transform ... ms` duration in .wheel-portrait CSS.
export const PORTRAIT_EXPAND_DURATION = 200;  // ms for portrait scale-in animation

// Auto-advance spotlight timing
export const SPOTLIGHT_HOLD_DURATION = 1500;  // ms to hold spotlight card center-stage
export const SPOTLIGHT_ENTER_DURATION = 500;  // ms for spotlight card enter animation
export const SPOTLIGHT_EXIT_DURATION = 400;   // ms for spotlight card exit animation
export const WHEELS_FADE_DURATION = 350;      // ms for wheels fade in/out
export const POST_LAND_PAUSE = 700;           // ms pause after wheels land (holds portrait tableau)
export const PROGRESS_FADE_DURATION = 200;    // ms for progress text cross-fade

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
