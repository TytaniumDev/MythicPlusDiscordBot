import { describe, expect, it } from 'vitest';
import { catchUpSpinDurations, revealStart, revealTimeline } from './revealTimeline';
import {
  WHEEL_SPIN_DURATIONS,
  SPOTLIGHT_HOLD_DURATION, SPOTLIGHT_ENTER_DURATION, SPOTLIGHT_EXIT_DURATION,
  WHEELS_FADE_DURATION, POST_LAND_PAUSE, REVEAL_LEAD_MS, RESULTS_PAUSE,
} from './timing';

const LONGEST_SPIN = Math.max(...WHEEL_SPIN_DURATIONS);
const SPOTLIGHT = SPOTLIGHT_ENTER_DURATION + SPOTLIGHT_HOLD_DURATION + SPOTLIGHT_EXIT_DURATION;
const FIRST_GROUP = LONGEST_SPIN + POST_LAND_PAUSE + WHEELS_FADE_DURATION + SPOTLIGHT;

describe('revealTimeline', () => {
  it('spins the first group straight away and lands it after the longest wheel', () => {
    const [first] = revealTimeline(1, 0).groups;
    expect(first.start).toBe(0);
    expect(first.spinStart).toBe(0);
    expect(first.landed).toBe(LONGEST_SPIN);
    expect(first.fadeOut).toBe(LONGEST_SPIN + POST_LAND_PAUSE);
    expect(first.spotlightIn).toBe(first.fadeOut + WHEELS_FADE_DURATION);
    expect(first.spotlightOut).toBe(first.spotlightIn + SPOTLIGHT_ENTER_DURATION + SPOTLIGHT_HOLD_DURATION);
    expect(first.end).toBe(FIRST_GROUP);
  });

  it('fades the wheels back in before each later group', () => {
    const [first, second] = revealTimeline(2, 0).groups;
    expect(second.start).toBe(first.end);
    expect(second.spinStart).toBe(first.end + WHEELS_FADE_DURATION);
    expect(second.end - second.start).toBe(FIRST_GROUP + WHEELS_FADE_DURATION);
  });

  it('shows remainder groups after the full ones, then pauses before the results', () => {
    const timeline = revealTimeline(1, 2);
    const [r1, r2] = timeline.remainders;
    expect(r1.start).toBe(timeline.groups[0].end);
    expect(r1.end - r1.start).toBe(SPOTLIGHT);
    expect(r2.start).toBe(r1.end);
    expect(timeline.end).toBe(r2.end + RESULTS_PAUSE);
  });

  it('goes straight to the results with no groups', () => {
    expect(revealTimeline(0, 0)).toEqual({ groups: [], remainders: [], end: RESULTS_PAUSE });
  });
});

describe('revealStart', () => {
  const now = 1_000_000;

  it('starts the lead after Spin was pressed', () => {
    expect(revealStart(now - 400, now)).toBe(now - 400 + REVEAL_LEAD_MS);
  });

  it('never waits longer than the lead when this clock is behind the server', () => {
    expect(revealStart(now + 60_000, now)).toBe(now + REVEAL_LEAD_MS);
  });

  it('starts in the past for a client that joins mid-reveal', () => {
    expect(revealStart(now - 20_000, now)).toBe(now - 20_000 + REVEAL_LEAD_MS);
  });

  it('starts now without a start time', () => {
    expect(revealStart(undefined, now)).toBe(now);
  });
});

describe('catchUpSpinDurations', () => {
  it('keeps the usual durations when on time or early', () => {
    expect(catchUpSpinDurations(0, 600)).toEqual(WHEEL_SPIN_DURATIONS);
    expect(catchUpSpinDurations(-200, 600)).toEqual(WHEEL_SPIN_DURATIONS);
  });

  it('shortens every wheel by the lateness, down to the minimum', () => {
    const late = WHEEL_SPIN_DURATIONS[0] - 100;
    const durations = catchUpSpinDurations(late, 600);
    expect(durations[0]).toBe(600);
    expect(durations[4]).toBe(WHEEL_SPIN_DURATIONS[4] - late);
  });
});
