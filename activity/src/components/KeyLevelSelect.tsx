import { KEY_LEVEL_MIN, KEY_LEVEL_MAX } from '../lib/keyLevel';

interface KeyLevelSelectProps {
  value: number;
  onChange: (level: number) => void;
  /** Used as the form-control id and tied to a wrapping label, if any. */
  id?: string;
  /** Visually-hidden label for assistive tech when no visible label is shown. */
  ariaLabel?: string;
  className?: string;
  /** Make the trigger compact for inline placement (e.g. inside a heading). */
  compact?: boolean;
}

const LEVELS: number[] = (() => {
  const out: number[] = [];
  for (let n = KEY_LEVEL_MIN; n <= KEY_LEVEL_MAX; n++) out.push(n);
  return out;
})();

/**
 * Native `<select>` for choosing a Mythic+ key level (2–20). Used both in the
 * lobby (to set the persistent default) and in the dungeon suggestions panel
 * (to drive the live ranking). Native select for keyboard/mobile parity.
 */
export function KeyLevelSelect({
  value,
  onChange,
  id,
  ariaLabel,
  className = '',
  compact = false,
}: KeyLevelSelectProps) {
  return (
    <select
      id={id}
      aria-label={ariaLabel}
      className={`key-level-select${compact ? ' key-level-select--compact' : ''}${className ? ' ' + className : ''}`}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {LEVELS.map((level) => (
        <option key={level} value={level}>+{level}</option>
      ))}
    </select>
  );
}
