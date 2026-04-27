import { useState, useCallback } from 'react';
import wheelsonIcon from '../img/wheelson.png';

interface SpinPromptProps {
  disabled?: boolean;
  onSpin: () => void;
}

const FADE_OUT_MS = 320;

const ORBITERS = [
  { angle: 35,  distance: 150, tiltDuration: 1.4, tiltDelay: 0,    bobDuration: 0.9, size: 60 },
  { angle: 130, distance: 195, tiltDuration: 1.1, tiltDelay: -0.3, bobDuration: 1.1, size: 52 },
  { angle: 220, distance: 130, tiltDuration: 1.6, tiltDelay: -0.7, bobDuration: 0.8, size: 64 },
  { angle: 305, distance: 205, tiltDuration: 1.2, tiltDelay: -0.5, bobDuration: 1.0, size: 48 },
];

const SPARKLES = [
  { angle: 15,  distance: 130, size: 4, duration: 1.6, delay: 0 },
  { angle: 70,  distance: 165, size: 6, duration: 2.1, delay: -0.4 },
  { angle: 120, distance: 145, size: 3, duration: 1.4, delay: -0.9 },
  { angle: 175, distance: 175, size: 5, duration: 1.8, delay: -0.2 },
  { angle: 225, distance: 120, size: 4, duration: 1.5, delay: -1.1 },
  { angle: 275, distance: 160, size: 6, duration: 2.2, delay: -0.6 },
  { angle: 320, distance: 140, size: 3, duration: 1.3, delay: -1.5 },
  { angle: 350, distance: 185, size: 5, duration: 1.9, delay: -0.8 },
];

function polar(angleDeg: number, distance: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: Math.cos(rad) * distance, y: Math.sin(rad) * distance };
}

export function SpinPrompt({ disabled, onSpin }: SpinPromptProps) {
  const [leaving, setLeaving] = useState(false);

  const handleClick = useCallback(() => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(onSpin, FADE_OUT_MS);
  }, [leaving, onSpin]);

  return (
    <div
      className={`spin-prompt${leaving ? ' spin-prompt--leaving' : ''}`}
      role="dialog"
      aria-label="Ready to spin"
    >
      <div className="spin-prompt__stage">
        {SPARKLES.map((s, i) => {
          const { x, y } = polar(s.angle, s.distance);
          return (
            <span
              key={`sparkle-${i}`}
              className="spin-sparkle"
              style={{
                width: `${s.size}px`,
                height: `${s.size}px`,
                left: `${x}px`,
                top: `${y}px`,
                animationDuration: `${s.duration}s`,
                animationDelay: `${s.delay}s`,
              }}
            />
          );
        })}

        {ORBITERS.map((o, i) => {
          const { x, y } = polar(o.angle, o.distance);
          return (
            <div
              key={i}
              className="spin-orbiter"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                animationDuration: `${o.tiltDuration}s`,
                animationDelay: `${o.tiltDelay}s`,
              }}
            >
              <div
                className="spin-orbiter__bob"
                style={{ animationDuration: `${o.bobDuration}s` }}
              >
                <img
                  src={wheelsonIcon}
                  alt=""
                  aria-hidden="true"
                  className="spin-orbiter__icon"
                  style={{ width: `${o.size}px`, height: `${o.size}px` }}
                  draggable={false}
                />
              </div>
            </div>
          );
        })}

        <button
          id="next-btn"
          type="button"
          className="spin-button"
          onClick={handleClick}
          disabled={disabled || leaving}
        >
          <span className="spin-button__halo" aria-hidden="true" />
          <span className="spin-button__label">Spin</span>
        </button>
      </div>
    </div>
  );
}
