// ── Configurable Timing Constants ────────────────────────────
export const CAROUSEL_SPIN_DURATION = 2000;   // ms per wheel in carousel mode
export const CAROUSEL_ADVANCE_DELAY = 400;    // ms pause after each landing
export const GRID_SPIN_DURATION = 4000;       // ms per wheel in grid mode

// Auto-advance spotlight timing
export const SPOTLIGHT_HOLD_DURATION = 3000;  // ms to hold spotlight card center-stage
export const SPOTLIGHT_ENTER_DURATION = 500;  // ms for spotlight card enter animation
export const SPOTLIGHT_EXIT_DURATION = 400;   // ms for spotlight card exit animation
export const WHEELS_FADE_DURATION = 350;      // ms for wheels fade in/out
export const POST_LAND_PAUSE = 800;           // ms pause after wheels land before fading out
export const PROGRESS_FADE_DURATION = 200;    // ms for progress text cross-fade

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
