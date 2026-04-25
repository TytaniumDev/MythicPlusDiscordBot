import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { WheelEntry } from '../types';
import { audio } from '../lib/audio';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor, getSliceColors } from '../lib/classColors';
import { PORTRAIT_EXPAND_DURATION, PORTRAIT_REVEAL_DELAY } from '../lib/timing';
import {
  EASE_OUT_CUBIC_CSS,
  computeTickTimes,
  finalRotationFor,
  offspecBandPath,
  sliceArcPath,
} from '../lib/wheelGeometry';

// Internal wheel coords use a 100-unit square centered at (50, 50). The
// viewBox is padded beyond that so the gold ring's drop-shadow glow has
// room to render outside the circle without clipping at the SVG edge.
const VB_PADDING = 6;
const CX = 50;
const CY = 50;
const RADIUS = 47; // matches the original canvas radius: size/2 - size*0.03

const DEFAULT_SPIN_DURATION = 4000;

export type WheelLabelClass = 'tank' | 'healer' | 'dps';

export interface WheelHandle {
  /** Replace entries + reset rotation/result. Used at the start of a spin. */
  init(entries: WheelEntry[]): void;
  /** Replace entries without resetting rotation or result. */
  updateEntries(entries: WheelEntry[]): void;
  /** Animate to land on the named winner. Resolves after portrait reveal. */
  spinTo(winnerName: string, duration?: number): Promise<string>;
  /** Cancel an in-flight spin, rejecting its promise. */
  cancel(): void;
  /** Clear the result text + winner highlight + portrait. */
  clearResult(): void;
  /** Toggle the spinning CSS state (pulse glow). spinTo manages this internally. */
  setSpinning(value: boolean): void;
  /** Root element — exposed for scroll-into-view in carousel mode. */
  readonly element: HTMLDivElement | null;
}

export interface WheelProps {
  role: string;
  label: string;
  labelClass: WheelLabelClass;
  ariaLabel: string;
  /** Storybook / test hook: initial entries + rotation + revealed winner. */
  initialEntries?: WheelEntry[];
  initialRotation?: number;
  initialWinner?: string | null;
  initialRevealed?: boolean;
}

export const Wheel = forwardRef<WheelHandle, WheelProps>(function Wheel(
  {
    role,
    label,
    labelClass,
    ariaLabel,
    initialEntries,
    initialRotation,
    initialWinner = null,
    initialRevealed = false,
  },
  ref,
) {
  const [entries, setEntries] = useState<WheelEntry[]>(initialEntries ?? []);
  const [rotation, setRotation] = useState(() => initialRotation ?? Math.random() * 2 * Math.PI);
  const [winnerName, setWinnerName] = useState<string | null>(initialWinner);
  const [isRevealed, setIsRevealed] = useState(initialRevealed);
  const [isSpinning, setIsSpinning] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const rotatorRef = useRef<SVGGElement | null>(null);
  const animationRef = useRef<Animation | null>(null);
  const tickTimeoutsRef = useRef<number[]>([]);
  const rejectSpinRef = useRef<((reason?: unknown) => void) | null>(null);

  // Mirror state into refs so imperative methods read current values.
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  const rotationRef = useRef(rotation);
  rotationRef.current = rotation;

  const winnerIndex = useMemo(() => {
    if (winnerName === null) return null;
    const idx = entries.findIndex((e) => e.name === winnerName);
    return idx === -1 ? null : idx;
  }, [entries, winnerName]);

  const variationIndices = useMemo(() => {
    const counts = new Map<string, number>();
    return entries.map((entry) => {
      const key = entry.characterClass ?? '__null__';
      const idx = counts.get(key) ?? 0;
      counts.set(key, idx + 1);
      return idx;
    });
  }, [entries]);

  const cancelInFlight = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }
    tickTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
    tickTimeoutsRef.current = [];
    if (rejectSpinRef.current) {
      rejectSpinRef.current('cancelled');
      rejectSpinRef.current = null;
    }
  }, []);

  useImperativeHandle(
    ref,
    (): WheelHandle => ({
      init(next) {
        cancelInFlight();
        setEntries(next);
        setRotation(Math.random() * 2 * Math.PI);
        setWinnerName(null);
        setIsRevealed(false);
        setIsSpinning(false);
      },
      updateEntries(next) {
        setEntries(next);
      },
      async spinTo(name, duration = DEFAULT_SPIN_DURATION) {
        cancelInFlight();
        // Warm the AudioContext synchronously while we still have the caller's
        // user-gesture activation — Safari and Storybook iframes refuse to
        // resume a suspended context from a setTimeout callback later.
        audio.prepare();
        const slices = entriesRef.current;
        const idx = slices.findIndex((e) => e.name === name);
        if (idx === -1) {
          setWinnerName(name);
          return name;
        }

        const startRotation = rotationRef.current;
        const extraFullRotations = 8 + Math.floor(Math.random() * 4);
        // Land at a random point inside the winning slice (not always the
        // center) for a bit of suspense. 0.8 keeps the pointer ≥10% of the
        // slice width away from each edge so there's no ambiguity about
        // which slice won.
        const sliceAngle = (2 * Math.PI) / slices.length;
        const offsetWithinSlice = (Math.random() - 0.5) * sliceAngle * 0.8;
        const adjusted = finalRotationFor(
          startRotation,
          idx,
          slices.length,
          extraFullRotations,
          offsetWithinSlice,
        );
        const startDeg = (startRotation * 180) / Math.PI;
        const endDeg = (adjusted * 180) / Math.PI;

        // Schedule per-segment tick sounds.
        const tickTimes = computeTickTimes(
          startRotation,
          adjusted,
          slices.length,
          duration,
        );
        tickTimeoutsRef.current = tickTimes.map((t) =>
          window.setTimeout(() => audio.tick(), t),
        );

        setIsSpinning(true);
        setWinnerName(null);
        setIsRevealed(false);

        const rotator = rotatorRef.current;
        if (!rotator) {
          // No DOM yet — skip animation, jump to final state.
          setRotation(adjusted);
          setWinnerName(name);
          setIsSpinning(false);
          setIsRevealed(true);
          return name;
        }

        const anim = rotator.animate(
          [
            { transform: `rotate(${startDeg}deg)` },
            { transform: `rotate(${endDeg}deg)` },
          ],
          { duration, easing: EASE_OUT_CUBIC_CSS, fill: 'forwards' },
        );
        animationRef.current = anim;

        return new Promise<string>((resolve, reject) => {
          rejectSpinRef.current = reject;
          anim.finished
            .then(() => {
              if (animationRef.current !== anim) return; // cancelled/replaced
              // Bake the final transform into inline style so canceling the
              // animation doesn't snap back to the React-tracked start value.
              try {
                anim.commitStyles();
              } catch {
                // intentional: commitStyles throws on some SVG elements in
                // older browsers; the fill:'forwards' rule keeps the final
                // transform visible anyway until React's next render, so
                // there's nothing the user can act on.
                void 0;
              }
              anim.cancel();
              animationRef.current = null;
              tickTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
              tickTimeoutsRef.current = [];

              setRotation(adjusted);
              setWinnerName(name);
              setIsSpinning(false);
              // Audio fires immediately so the "pop" lands on the visible stop;
              // the portrait reveal is delayed for a more deliberate beat.
              audio.land();

              // Track these timeouts so a subsequent cancel/init clears them
              // and they can't fire setIsRevealed/resolve after the wheel has
              // already been reset. rejectSpinRef stays populated until the
              // resolveTimeout fires so a cancel during the reveal delay still
              // rejects the promise instead of leaking it.
              const revealTimeout = window.setTimeout(() => {
                // Trigger portrait CSS transition on the next frame so the
                // transform: scale(0) → scale(1) actually fires.
                requestAnimationFrame(() => setIsRevealed(true));
              }, PORTRAIT_REVEAL_DELAY);
              const resolveTimeout = window.setTimeout(() => {
                rejectSpinRef.current = null;
                resolve(name);
              }, PORTRAIT_REVEAL_DELAY + PORTRAIT_EXPAND_DURATION);
              tickTimeoutsRef.current.push(revealTimeout, resolveTimeout);
            })
            .catch(() => {
              // Animation was cancelled — rejection is handled by cancelInFlight.
              tickTimeoutsRef.current.forEach((id) => window.clearTimeout(id));
              tickTimeoutsRef.current = [];
              setIsSpinning(false);
            });
        });
      },
      cancel() {
        cancelInFlight();
        setIsSpinning(false);
      },
      clearResult() {
        setWinnerName(null);
        setIsRevealed(false);
      },
      setSpinning(value) {
        setIsSpinning(value);
      },
      get element() {
        return rootRef.current;
      },
    }),
    [cancelInFlight],
  );

  useEffect(() => cancelInFlight, [cancelInFlight]);

  const sliceAngle = entries.length > 0 ? (2 * Math.PI) / entries.length : 0;
  const rotationDeg = (rotation * 180) / Math.PI;
  const highlightActive = winnerIndex !== null;

  const dynamicAriaLabel = isSpinning
    ? `${ariaLabel}. Spinning...`
    : winnerName
      ? `${ariaLabel}. Result: ${winnerName}`
      : entries.length > 0
        ? `${ariaLabel}. ${entries.length} candidates.`
        : ariaLabel;

  const winnerEntry = winnerIndex !== null ? entries[winnerIndex] : null;

  return (
    <div
      ref={rootRef}
      className={`wheel-slot${isSpinning ? ' spinning' : ''}`}
      id={`slot-${role}`}
      data-testid={`wheel-slot-${role}`}
    >
      <span className={`wheel-label label-${labelClass}`}>{label}</span>
      <div className="wheel-frame">
        {entries.length > 0 && <div className="wheel-pointer" />}
        <svg
          viewBox={`${-VB_PADDING} ${-VB_PADDING} ${100 + VB_PADDING * 2} ${100 + VB_PADDING * 2}`}
          className="wheel-svg"
          id={`wheel-${role}`}
          role="img"
          aria-label={dynamicAriaLabel}
        >
          {/* The outer <g> positions the rotator's local origin at the
              wheel center in user coords. The rotator then rotates around
              its own (0,0) — no transform-box / transform-origin needed,
              so viewBox padding can't shift the rotation center. */}
          <g transform={`translate(${CX} ${CY})`}>
            <g
              ref={rotatorRef}
              className="wheel-rotator"
              style={{ transform: `rotate(${rotationDeg}deg)` }}
            >
              {entries.length === 0 ? (
                <>
                  <circle cx={0} cy={0} r={RADIUS} fill="#1a1a2e" />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="wheel-empty-text"
                  >
                    No candidates
                  </text>
                </>
              ) : (
                entries.map((entry, i) => {
                  const startAngle = i * sliceAngle;
                  const endAngle = startAngle + sliceAngle;
                  const midAngle = startAngle + sliceAngle / 2;
                  const midDeg = (midAngle * 180) / Math.PI;
                  const isWinner = winnerIndex === i;
                  const isLoser = highlightActive && !isWinner;
                  const sliceFill = getSliceColors(entry.characterClass, variationIndices[i]);
                  const sliceClass = [
                    'wheel-slice',
                    entry.isChosen ? 'wheel-slice--chosen' : '',
                    isWinner ? 'wheel-slice--winner' : '',
                    isLoser ? 'wheel-slice--loser' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  // Center the label along the radial axis of the slice, biased
                  // ~2 viewBox units outward so short names don't crowd the hub.
                  const textX = RADIUS / 2 + 2;
                  const fontScale = Math.min(1, Math.sqrt(6 / entries.length));
                  const fontSize = Math.max(3, Math.min(7, 6 * fontScale));
                  const displayName =
                    entry.name.length > 12 ? entry.name.slice(0, 11) + '..' : entry.name;
                  // Flip text on the bottom half so it doesn't render upside-down.
                  // midDeg is the slice center's screen angle (0 = right, 90 = down).
                  // When midDeg is in (90°, 270°) the baseline after rotation points
                  // back toward the reader — flip by adding 180° and placing the
                  // anchor at -textX (same visible position, readable orientation).
                  const normDeg = ((midDeg % 360) + 360) % 360;
                  const flip = normDeg > 90 && normDeg < 270;
                  const textRotDeg = flip ? normDeg + 180 : normDeg;
                  const textAnchorX = flip ? -textX : textX;

                  // Offspec slices render as a class-colored band hugging the slice
                  // perimeter (full opacity) over a translucent fill of the same
                  // class color (so the interior reads as a faded version of the
                  // band). Mainspec slices render as a fully filled wedge.
                  const slicePath = entry.isOffspec
                    ? // arcThickness > thickness compensates for the outer ring
                      // (~1 unit) overlapping the slice's outer edge, which would
                      // otherwise make the arc-side band read thinner than the
                      // radial sides. tipRadius rounds the inner apex into a fillet.
                      offspecBandPath(0, 0, RADIUS, startAngle, endAngle, 1.75, 0.75, 3, 0.75)
                    : sliceArcPath(0, 0, RADIUS, startAngle, endAngle);
                  return (
                    <g key={`${role}-slice-${i}`} className={sliceClass}>
                      {entry.isOffspec && (
                        <path
                          className="wheel-slice__fill"
                          d={sliceArcPath(0, 0, RADIUS, startAngle, endAngle)}
                          style={{ fill: sliceFill, fillOpacity: 0.85, stroke: 'none' }}
                        />
                      )}
                      <path
                        className="wheel-slice__fill"
                        d={slicePath}
                        fillRule={entry.isOffspec ? 'evenodd' : undefined}
                        style={{
                          fill: sliceFill,
                          // Disable the inherited thin slice-divider stroke on
                          // offspec bands — it would otherwise outline the
                          // inner "hole" path as well.
                          stroke: entry.isOffspec ? 'none' : undefined,
                        }}
                      />
                      <text
                        className="wheel-slice__label"
                        x={textAnchorX}
                        y={0}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={fontSize}
                        transform={`rotate(${textRotDeg})`}
                      >
                        {displayName}
                      </text>
                    </g>
                  );
                })
              )}

              {winnerIndex !== null && entries.length > 0 && (
                <path
                  className="wheel-winner-glow"
                  d={sliceArcPath(
                    0,
                    0,
                    RADIUS - 0.5,
                    winnerIndex * sliceAngle,
                    (winnerIndex + 1) * sliceAngle,
                  )}
                />
              )}
            </g>
          </g>

          {/* Fixed outer ring */}
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke="#1a1a2e"
            strokeWidth="2"
          />
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="1"
            className="wheel-outer-ring"
          />
          {/* Fixed center hub */}
          {entries.length > 0 && (
            <circle
              cx={CX}
              cy={CY}
              r={2}
              fill="#0d0d1a"
              stroke="#f59e0b"
              strokeWidth="0.4"
            />
          )}
        </svg>
        <WinnerPortrait entry={winnerEntry} revealed={isRevealed} />
      </div>
      <div
        id={`result-${role}`}
        className={`wheel-result${winnerName ? ' revealed' : ''}`}
        aria-live="polite"
      >
        {winnerName ?? ''}
      </div>
    </div>
  );
});

function WinnerPortrait({
  entry,
  revealed,
}: {
  entry: WheelEntry | null;
  revealed: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [entry?.name, entry?.mediaUrl]);

  // The outer div is always mounted so that its `transform: scale(0)` state
  // is painted before the `is-revealing` class flips it to scale(1) —
  // otherwise the mount and the class change commit in the same paint and
  // the CSS transition is skipped.
  const classColor = entry ? getClassColor(entry.characterClass) : null;
  const avatarUrl = entry ? toAvatarUrl(entry.mediaUrl) : null;
  const proxied = avatarUrl ? remapImageUrl(avatarUrl) : null;
  const showImg = Boolean(proxied) && !imgFailed;
  const fallbackGlyph = entry ? entry.name.charAt(0).toUpperCase() || '?' : '';

  const style = classColor
    ? ({ '--wp-color': classColor } as CSSProperties)
    : undefined;

  return (
    <div
      className={`wheel-portrait${revealed && entry ? ' is-revealing' : ''}`}
      style={style}
      aria-hidden="true"
    >
      {entry && showImg && (
        <img
          className="wheel-portrait__img"
          src={proxied ?? undefined}
          alt=""
          onError={() => setImgFailed(true)}
        />
      )}
      {entry && !showImg && (
        <div className="wheel-portrait__fallback">{fallbackGlyph}</div>
      )}
    </div>
  );
}

