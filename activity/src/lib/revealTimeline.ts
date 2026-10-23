import {
  WHEEL_SPIN_DURATIONS,
  SPOTLIGHT_HOLD_DURATION, SPOTLIGHT_ENTER_DURATION, SPOTLIGHT_EXIT_DURATION,
  WHEELS_FADE_DURATION, POST_LAND_PAUSE, REVEAL_LEAD_MS, RESULTS_PAUSE,
} from './timing';

// The reveal as one timeline that every client plays from the same start
// time, so all screens spin, land and show each group together. Times are ms
// from the start; the WheelsView loop waits until each one instead of
// sleeping a fixed time, so a client that falls behind catches up at the next
// step.

/** One full group: wheels spin, land and fade out, then its spotlight card. */
export interface GroupSteps {
  /** Wheels start fading back in (from the second group on). */
  start: number;
  spinStart: number;
  /** The last wheel lands. */
  landed: number;
  /** Wheels start fading out. */
  fadeOut: number;
  /** The spotlight card starts coming in. */
  spotlightIn: number;
  /** The spotlight card starts leaving. */
  spotlightOut: number;
  /** The spotlight has left and the group card goes in the list. */
  end: number;
}

/** A remainder group: its spotlight card only, no wheels. */
export interface RemainderSteps {
  /** The spotlight card starts coming in. */
  start: number;
  spotlightOut: number;
  end: number;
}

export interface RevealTimeline {
  groups: GroupSteps[];
  remainders: RemainderSteps[];
  /** When the client moves to the results screen. */
  end: number;
}

const LONGEST_SPIN = Math.max(...WHEEL_SPIN_DURATIONS);

export function revealTimeline(fullCount: number, remainderCount: number): RevealTimeline {
  let t = 0;
  const groups: GroupSteps[] = [];
  for (let i = 0; i < fullCount; i++) {
    const start = t;
    // The first group's wheels are already showing.
    const spinStart = i > 0 ? start + WHEELS_FADE_DURATION : start;
    const landed = spinStart + LONGEST_SPIN;
    const fadeOut = landed + POST_LAND_PAUSE;
    const spotlightIn = fadeOut + WHEELS_FADE_DURATION;
    const spotlightOut = spotlightIn + SPOTLIGHT_ENTER_DURATION + SPOTLIGHT_HOLD_DURATION;
    const end = spotlightOut + SPOTLIGHT_EXIT_DURATION;
    groups.push({ start, spinStart, landed, fadeOut, spotlightIn, spotlightOut, end });
    t = end;
  }

  const remainders: RemainderSteps[] = [];
  for (let i = 0; i < remainderCount; i++) {
    const start = t;
    const spotlightOut = start + SPOTLIGHT_ENTER_DURATION + SPOTLIGHT_HOLD_DURATION;
    const end = spotlightOut + SPOTLIGHT_EXIT_DURATION;
    remainders.push({ start, spotlightOut, end });
    t = end;
  }

  return { groups, remainders, end: t + RESULTS_PAUSE };
}

/**
 * The local time (ms since the epoch) the reveal's timeline starts at.
 * `revealStartAt` is the server time Spin was pressed, and the reveal begins
 * `REVEAL_LEAD_MS` after it so every client has the update by then. A clock
 * running behind the server never waits longer than the lead; one running
 * ahead, or a client that reconnects mid-reveal, starts partway in. Without a
 * start time (demo mode, or a round started by an older client) the reveal
 * starts now.
 */
export function revealStart(revealStartAt: number | undefined, now: number): number {
  if (revealStartAt === undefined) return now;
  return Math.min(revealStartAt + REVEAL_LEAD_MS, now + REVEAL_LEAD_MS);
}

/**
 * Wheel spin durations shortened by however late the spin starts, so a client
 * that starts late still lands with everyone else.
 */
export function catchUpSpinDurations(lateBy: number, minDuration: number): number[] {
  const late = Math.max(0, lateBy);
  return WHEEL_SPIN_DURATIONS.map((d) => Math.max(minDuration, d - late));
}
