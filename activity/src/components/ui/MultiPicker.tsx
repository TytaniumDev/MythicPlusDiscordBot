import { ToggleButton } from './ToggleButton';

export interface PickerOption {
  label: string;
  value: string;
  activeColor?: 'tank' | 'healer' | 'dps' | 'brez' | 'lust' | 'sitting-out';
}

interface MultiPickerProps {
  label: string;
  options: PickerOption[];
  selected: string[];
  onToggle: (value: string) => void;
  /** If true, only one option can be selected at a time */
  exclusive?: boolean;
  className?: string;
}

export function MultiPicker({ label, options, selected, onToggle, className = '' }: MultiPickerProps) {
  return (
    <div className={`ui-multi-picker ${className}`}>
      <div className="ui-multi-picker-label">{label}</div>
      <div className="ui-multi-picker-options">
        {options.map((opt) => (
          <ToggleButton
            key={opt.value}
            label={opt.label}
            active={selected.includes(opt.value)}
            activeColor={opt.activeColor}
            onClick={() => onToggle(opt.value)}
          />
        ))}
      </div>
    </div>
  );
}
