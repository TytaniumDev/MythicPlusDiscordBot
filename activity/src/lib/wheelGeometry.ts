/**
 * Pure geometry + animation math for the wheel-of-fortune component.
 *
 * Angles are in radians. 0 = +x axis (3 o'clock). Positive angles rotate
 * clockwise in screen coordinates (because SVG's +y axis points down).
 * Slice index 0 starts at angle 0; slice k spans [k*sliceAngle, (k+1)*sliceAngle).
 */

export const EASE_OUT_CUBIC_CSS = 'cubic-bezier(0.215, 0.61, 0.355, 1)';

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** Inverse of easeOutCubic: given an eased output in [0,1], return the input. */
export function invEaseOutCubic(f: number): number {
  return 1 - Math.cbrt(1 - f);
}

function polar(cx: number, cy: number, r: number, angleRad: number): [number, number] {
  return [cx + r * Math.cos(angleRad), cy + r * Math.sin(angleRad)];
}

/**
 * SVG path `d` attribute for a single pie slice from center.
 * Handles a full-circle sweep (used when there's only one slice).
 */
export function sliceArcPath(
  cx: number,
  cy: number,
  r: number,
  startAngleRad: number,
  endAngleRad: number,
): string {
  const sweep = endAngleRad - startAngleRad;
  if (Math.abs(sweep) >= 2 * Math.PI - 1e-6) {
    // Full circle — two half-arcs
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`;
  }
  const [sx, sy] = polar(cx, cy, r, startAngleRad);
  const [ex, ey] = polar(cx, cy, r, endAngleRad);
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep > 0 ? 1 : 0;
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${ex} ${ey} Z`;
}

/**
 * Rotation (radians) that places a point inside slice `winnerIndex` under
 * the top pointer, guaranteed to be `startRotation` plus a forward
 * (positive/clockwise) delta of at least `extraFullRotations` full turns.
 *
 * `offsetWithinSlice` (radians, signed) shifts the landing point away from
 * the slice's center — caller is responsible for keeping it inside
 * `(-sliceAngle/2, +sliceAngle/2)` so the pointer stays in the winner's
 * slice. Pass 0 to land at dead center.
 *
 * Taking `startRotation` as an input is what keeps the spin clockwise and
 * fast across back-to-back spins, where the wheel's accumulated rotation
 * would otherwise make a raw target-angle computation land behind the
 * current position and produce a backwards or slow spin.
 */
export function finalRotationFor(
  startRotation: number,
  winnerIndex: number,
  sliceCount: number,
  extraFullRotations: number,
  offsetWithinSlice = 0,
): number {
  const sliceAngle = (2 * Math.PI) / sliceCount;
  const winnerCenter = winnerIndex * sliceAngle + sliceAngle / 2;
  // Smallest positive rotation that puts the (winnerCenter + offset) point at
  // the top pointer (-π/2). Works mod 2π so it's independent of
  // `startRotation`'s magnitude.
  const modTwoPi = 2 * Math.PI;
  let forwardDelta =
    ((-Math.PI / 2 - winnerCenter - offsetWithinSlice - startRotation) % modTwoPi +
      modTwoPi) %
    modTwoPi;
  // Avoid a "no movement" spin when we already happen to be exactly on target.
  if (forwardDelta < 1e-6) forwardDelta += modTwoPi;
  return startRotation + forwardDelta + modTwoPi * extraFullRotations;
}

/**
 * Timestamps (ms from animation start) at which a slice boundary crosses
 * the top pointer, so the caller can schedule tick sounds that perfectly
 * line up with the visible dividing lines passing by.
 *
 * Slice boundaries sit at unrotated angles `k*sliceAngle`. After rotation R
 * they're at `R + k*sliceAngle`. A tick should fire when any of them
 * equals -π/2 (the pointer), i.e., when R = -π/2 + k*sliceAngle (mod 2π).
 * We find all such R values in the rotation's traversal and time them
 * via the ease-out progress inverse.
 *
 * Assumes easeOutCubic easing and monotonic rotation from start to end.
 */
export function computeTickTimes(
  startRotation: number,
  finalRotation: number,
  sliceCount: number,
  duration: number,
): number[] {
  if (sliceCount <= 0 || duration <= 0) return [];
  const delta = finalRotation - startRotation;
  if (delta === 0) return [];
  const sliceAngle = (2 * Math.PI) / sliceCount;
  const pointerAngle = -Math.PI / 2;
  const lo = Math.min(startRotation, finalRotation);
  const hi = Math.max(startRotation, finalRotation);

  // Integer k range such that pointerAngle + k*sliceAngle ∈ (lo, hi].
  const kMin = Math.floor((lo - pointerAngle) / sliceAngle) + 1;
  const kMax = Math.floor((hi - pointerAngle) / sliceAngle);

  const times: number[] = [];
  for (let k = kMin; k <= kMax; k++) {
    const rk = pointerAngle + k * sliceAngle;
    const progress = (rk - startRotation) / delta;
    if (progress > 0 && progress <= 1) {
      times.push(invEaseOutCubic(progress) * duration);
    }
  }
  // For reverse spin, k ascends but progress descends — sort to get
  // chronological order.
  times.sort((a, b) => a - b);
  return times;
}
