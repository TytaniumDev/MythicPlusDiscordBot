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
 * SVG path for an "offspec band" — a class-colored band hugging the inside
 * of a slice's perimeter, leaving an empty rounded interior. Composes the
 * full slice (outer subpath) with an inset slice with rounded outer-arc
 * corners (inner subpath, treated as a hole via fill-rule:evenodd).
 */
export function offspecBandPath(
  cx: number,
  cy: number,
  R: number,
  startAngleRad: number,
  endAngleRad: number,
  thickness: number,
  cornerRadius: number,
  // Optional override: arc-side band thickness can differ from the radial
  // thickness to compensate for the outer ring overlapping the slice's outer
  // edge. Defaults to `thickness`.
  arcThickness: number = thickness,
  // Optional fillet radius for the inner apex (where the two inset radials
  // would otherwise meet at a sharp V). 0 = sharp tip. Clamped so the fillet
  // can't overlap the inner-arc corners.
  tipRadius: number = 0,
): string {
  // Inner-hole boundary: the two radial sides are *parallel* to the outer
  // radials (offset perpendicular by `thickness` toward the slice mid-line)
  // so the band stays a constant width, instead of tapering toward the hub.
  // The two inset radials meet on the bisector at distance thickness/sin(halfAngle)
  // from origin — that's the inner tip of the hole.
  const innerR = Math.max(R - arcThickness, 0.1);
  const halfAngle = (endAngleRad - startAngleRad) / 2;
  const mid = (startAngleRad + endAngleRad) / 2;

  const outer = sliceArcPath(cx, cy, R, startAngleRad, endAngleRad);

  // Where each inset radial meets the inner arc (radius innerR).
  // From the perpendicular-offset geometry: t = sqrt(innerR² - thickness²),
  // and the meet point is at radius innerR, angle α ± arctan(thickness / t).
  const innerSq = innerR * innerR - thickness * thickness;
  if (innerSq <= 0) {
    // Band thickness is too large for the slice radius — fall back to a
    // plain inset slice with no inner geometry (band fills almost everything).
    return outer;
  }
  const t = Math.sqrt(innerSq);
  const dArc = Math.atan2(thickness, t);
  const arcStart = startAngleRad + dArc;
  const arcEnd = endAngleRad - dArc;

  // Sharp-tip distance: where the two inset radials would meet on the bisector.
  const dTip = thickness / Math.sin(halfAngle);

  // Clamp corner radius so the two rounded corners don't collide along the
  // inner arc, and stay smaller than the band thickness.
  const maxCorner = Math.min(thickness * 0.9, innerR * Math.max(arcEnd - arcStart, 0) * 0.45);
  const cr = Math.max(0, Math.min(cornerRadius, maxCorner));
  const aOff = cr > 0 ? Math.asin(Math.min(cr / innerR, 1)) : 0;

  // Tip-fillet geometry: a circle of radius `tipR` tangent to both inset
  // radials, centered on the bisector at d_center = (thickness + tipR)/sin(halfAngle).
  // The tangent points sit at radial-parameter t_Q = d_center * cos(halfAngle)
  // along each inset radial. Clamp so the fillet doesn't push past where the
  // inner-arc corners are about to start.
  const maxTip = Math.max(0, t * Math.tan(halfAngle) - thickness);
  const tipR = Math.max(0, Math.min(tipRadius, maxTip));
  const dCenter = tipR > 0 ? (thickness + tipR) / Math.sin(halfAngle) : dTip;
  const tQ = tipR > 0 ? dCenter * Math.cos(halfAngle) : thickness / Math.tan(halfAngle);

  // Points on the inset radials. `tFromFoot` is parameter along the radial from
  // the foot of perpendicular; cr is for the outer corner (near inner arc),
  // tQ is the tangent point near the inner tip.
  const insetRadial = (angle: number, tFromFoot: number): [number, number] => {
    // Foot of the perpendicular from origin to the inset radial.
    const sign = angle === startAngleRad ? -1 : 1;
    const fx = cx + sign * thickness * Math.sin(angle);
    const fy = cy - sign * thickness * Math.cos(angle);
    return [fx + tFromFoot * Math.cos(angle), fy + tFromFoot * Math.sin(angle)];
  };
  const [p1x, p1y] = insetRadial(startAngleRad, t - cr);
  const [p2x, p2y] = polar(cx, cy, innerR, arcStart + aOff);
  const [p3x, p3y] = polar(cx, cy, innerR, arcEnd - aOff);
  const [p4x, p4y] = insetRadial(endAngleRad, t - cr);
  const innerSweep = (arcEnd - aOff) - (arcStart + aOff);
  const largeInner = Math.abs(innerSweep) > Math.PI ? 1 : 0;

  let startX: number;
  let startY: number;
  let closingSegment: string;
  if (tipR > 0) {
    const [qLeftX, qLeftY] = insetRadial(startAngleRad, tQ);
    const [qRightX, qRightY] = insetRadial(endAngleRad, tQ);
    startX = qLeftX;
    startY = qLeftY;
    // Tip arc curves around the fillet center (further from origin than the
    // apex would be), bulging back toward origin. Sweep flag is opposite the
    // inner-arc sweep so the concavity faces outward.
    closingSegment = ` L ${qRightX} ${qRightY} A ${tipR} ${tipR} 0 0 1 ${qLeftX} ${qLeftY} Z`;
  } else {
    const [tipX, tipY] = polar(cx, cy, dTip, mid);
    startX = tipX;
    startY = tipY;
    closingSegment = ` L ${tipX} ${tipY} Z`;
  }

  const inner =
    `M ${startX} ${startY} L ${p1x} ${p1y}` +
    (cr > 0 ? ` A ${cr} ${cr} 0 0 1 ${p2x} ${p2y}` : '') +
    ` A ${innerR} ${innerR} 0 ${largeInner} 1 ${p3x} ${p3y}` +
    (cr > 0 ? ` A ${cr} ${cr} 0 0 1 ${p4x} ${p4y}` : '') +
    closingSegment;

  return `${outer} ${inner}`;
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
