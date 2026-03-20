import type { InputHTMLAttributes } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
}

export function Checkbox({ label, className = '', id, ...props }: CheckboxProps) {
  return (
    <label className={`ui-checkbox ${className}`} htmlFor={id}>
      <input type="checkbox" id={id} {...props} />
      <span className="ui-checkbox-label">{label}</span>
    </label>
  );
}
