import { describe, it, expect } from 'vitest';
import {
  easeOutCubic,
  invEaseOutCubic,
  sliceArcPath,
  finalRotationFor,
  computeTickTimes,
} from './wheelGeometry';

describe('easeOutCubic', () => {
  it('maps the endpoints', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
  });

  it('is fast early, slow late (classic ease-out)', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 3);
    expect(easeOutCubic(0.9)).toBeCloseTo(0.999, 3);
  });
});

describe('invEaseOutCubic', () => {
  it('round-trips with easeOutCubic', () => {
    for (const x of [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1]) {
      expect(invEaseOutCubic(easeOutCubic(x))).toBeCloseTo(x, 6);
    }
  });
});

describe('sliceArcPath', () => {
  it('produces a closed path for a normal slice', () => {
    const d = sliceArcPath(50, 50, 47, 0, Math.PI / 2);
    expect(d).toMatch(/^M 50 50 L/);
    expect(d).toMatch(/A 47 47/);
    expect(d.trim().endsWith('Z')).toBe(true);
  });

  it('sets large-arc-flag when sweep exceeds π', () => {
    const d = sliceArcPath(50, 50, 47, 0, Math.PI + 0.1);
    // The flags appear right after the second "47" as "0 <largeArc> <sweep>"
    expect(d).toMatch(/A 47 47 0 1 1/);
  });

  it('uses two half-arcs for a full-circle slice', () => {
    const d = sliceArcPath(50, 50, 47, 0, 2 * Math.PI);
    // Two "A" arc commands, no center moveto
    const arcCount = (d.match(/A /g) ?? []).length;
    expect(arcCount).toBe(2);
    expect(d).not.toMatch(/L 50 50/);
  });
});

describe('finalRotationFor', () => {
  it('places the winning slice at the top (pointer) when applied', () => {
    // Given 4 slices and winner at index 0, a rotation that places slice 0 at the
    // top means the slice's center angle (originally +π/4 = 45°) ends up at -π/2 (top).
    const rotation = finalRotationFor(0, 0, 4, 0);
    const sliceAngle = (2 * Math.PI) / 4;
    const sliceCenterAfterRotation = rotation + 0 * sliceAngle + sliceAngle / 2;
    // Should equal -π/2 modulo 2π
    const normalized = ((sliceCenterAfterRotation + Math.PI) % (2 * Math.PI)) - Math.PI;
    expect(normalized).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('places different winners at the top without overlap', () => {
    const sliceCount = 5;
    const sliceAngle = (2 * Math.PI) / sliceCount;
    for (let i = 0; i < sliceCount; i++) {
      const rotation = finalRotationFor(0, i, sliceCount, 0);
      const sliceCenter = rotation + i * sliceAngle + sliceAngle / 2;
      const wrapped = ((sliceCenter + Math.PI) % (2 * Math.PI)) - Math.PI;
      expect(wrapped).toBeCloseTo(-Math.PI / 2, 6);
    }
  });

  it('adds 2π per extra full rotation', () => {
    const base = finalRotationFor(0, 0, 4, 0);
    const withExtra = finalRotationFor(0, 0, 4, 3);
    expect(withExtra - base).toBeCloseTo(3 * 2 * Math.PI, 6);
  });

  it('spins forward regardless of accumulated startRotation', () => {
    // Simulate rotation that accumulated across many prior spins.
    for (const startRotation of [0, 10, 50 * Math.PI, -30, 123.456]) {
      for (let winnerIndex = 0; winnerIndex < 5; winnerIndex++) {
        const r = finalRotationFor(startRotation, winnerIndex, 5, 8);
        expect(r).toBeGreaterThan(startRotation);
        expect(r - startRotation).toBeGreaterThanOrEqual(2 * Math.PI * 8);
        // And the winner lands at the top.
        const sliceAngle = (2 * Math.PI) / 5;
        const sliceCenter = r + winnerIndex * sliceAngle + sliceAngle / 2;
        const wrapped = ((sliceCenter + Math.PI) % (2 * Math.PI)) - Math.PI;
        expect(wrapped).toBeCloseTo(-Math.PI / 2, 6);
      }
    }
  });

  it('never returns a zero-distance spin when already on target', () => {
    // If startRotation already places winner at top, we should still add a full
    // extra turn so the wheel visibly moves.
    const sliceCount = 4;
    const onTarget = finalRotationFor(0, 0, sliceCount, 0);
    const again = finalRotationFor(onTarget, 0, sliceCount, 0);
    expect(again - onTarget).toBeCloseTo(2 * Math.PI, 4);
  });

  it('offsetWithinSlice shifts the landing point but stays inside the slice', () => {
    const sliceCount = 5;
    const sliceAngle = (2 * Math.PI) / sliceCount;
    const winnerIndex = 2;
    for (const frac of [-0.49, -0.3, 0, 0.3, 0.49]) {
      const offset = sliceAngle * frac;
      const r = finalRotationFor(0, winnerIndex, sliceCount, 0, offset);
      // The unrotated angle the pointer is looking at after rotation r:
      const pointerAngle = -Math.PI / 2;
      const modTwoPi = 2 * Math.PI;
      const unrotated = ((pointerAngle - r) % modTwoPi + modTwoPi) % modTwoPi;
      const landedSlice = Math.floor(unrotated / sliceAngle);
      expect(landedSlice).toBe(winnerIndex);
      // And the position within the slice should match the requested offset.
      const posInSlice = unrotated - (winnerIndex * sliceAngle + sliceAngle / 2);
      expect(posInSlice).toBeCloseTo(offset, 5);
    }
  });
});

describe('computeTickTimes', () => {
  it('returns one tick per segment crossed', () => {
    const sliceCount = 5;
    const sliceAngle = (2 * Math.PI) / sliceCount;
    const start = 0;
    const end = 3 * sliceAngle; // exactly 3 boundaries crossed
    const times = computeTickTimes(start, end, sliceCount, 1000);
    expect(times).toHaveLength(3);
  });

  it('produces monotonically increasing times', () => {
    const times = computeTickTimes(0, 10 * Math.PI, 5, 4000);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('ticks are back-loaded (ease-out slows near the end)', () => {
    // With ease-out, most segments are crossed early, later ones take longer gaps.
    const times = computeTickTimes(0, 10 * Math.PI, 5, 4000);
    const firstGap = times[1] - times[0];
    const lastGap = times[times.length - 1] - times[times.length - 2];
    expect(lastGap).toBeGreaterThan(firstGap);
  });

  it('places the final tick no later than the animation end', () => {
    const times = computeTickTimes(0, 10 * Math.PI, 5, 4000);
    expect(times[times.length - 1]).toBeLessThanOrEqual(4000);
  });

  it('returns empty for zero-length spin', () => {
    expect(computeTickTimes(0, 0, 5, 1000)).toEqual([]);
  });

  it('handles negative delta (reverse spin)', () => {
    const times = computeTickTimes(0, -4 * Math.PI, 5, 1000);
    // 4π of rotation at 2π/5 per slice = 10 crossings
    expect(times).toHaveLength(10);
  });

  it('first tick fires at the first boundary crossing, not after a full slice', () => {
    // Place start rotation a quarter-slice past a boundary. The next
    // dividing line should cross the pointer after only 3/4 of a slice of
    // rotation — the old "startRotation + k*sliceAngle" approach would
    // have waited a full sliceAngle and missed the real boundary.
    const sliceCount = 4;
    const sliceAngle = (2 * Math.PI) / sliceCount;
    const pointerAngle = -Math.PI / 2;
    const startRotation = pointerAngle + 0.25 * sliceAngle;
    const delta = 5 * sliceAngle;
    const finalRotation = startRotation + delta;
    const duration = 1000;

    const times = computeTickTimes(startRotation, finalRotation, sliceCount, duration);
    // First boundary at +0.75 sliceAngle from start → progress 0.75/5 = 0.15.
    const expectedFirstProgress = 0.75 / 5;
    expect(times[0]).toBeCloseTo(invEaseOutCubic(expectedFirstProgress) * duration, 3);
    // Boundaries every sliceAngle from there, 5 total crossings in 5 sliceAngles.
    expect(times).toHaveLength(5);
  });

  it('last tick fires at the final boundary just before landing in the slice', () => {
    // Use the real finalRotationFor so we know exactly where the wheel
    // lands; derive the last-boundary expectation from the same primitives
    // the caller will. For forward spin with positive offsetWithinSlice
    // (pointer lands past the slice center toward the upper edge), the last
    // dividing line crossed sits at finalRotation - (sliceAngle/2 - offset).
    const sliceCount = 5;
    const sliceAngle = (2 * Math.PI) / sliceCount;
    const startRotation = 0;
    const winnerIndex = 2;
    const extraFullRotations = 8;
    const offsetWithinSlice = 0.1 * sliceAngle;
    const duration = 4000;
    const finalRotation = finalRotationFor(
      startRotation,
      winnerIndex,
      sliceCount,
      extraFullRotations,
      offsetWithinSlice,
    );
    const times = computeTickTimes(startRotation, finalRotation, sliceCount, duration);
    const lastTickTime = times[times.length - 1];
    const lastBoundaryRotation = finalRotation - (sliceAngle / 2 - offsetWithinSlice);
    const expectedProgress =
      (lastBoundaryRotation - startRotation) / (finalRotation - startRotation);
    expect(lastTickTime).toBeCloseTo(invEaseOutCubic(expectedProgress) * duration, 3);
    expect(lastTickTime).toBeLessThan(duration);
  });
});
