import type { ButtonHTMLAttributes } from 'react';

interface ToggleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  activeColor?: 'tank' | 'healer' | 'dps' | 'brez' | 'lust' | 'sitting-out';
}

export function ToggleButton({ label, active, activeColor, className = '', ...props }: ToggleButtonProps) {
  const activeClass = active && activeColor ? `active-${activeColor}` : '';

  return (
    <button
      className={`role-btn ${activeClass} ${className}`}
      {...props}
    >
      {label}
    </button>
  );
}
