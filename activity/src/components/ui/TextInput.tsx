import type { InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextInput({ label, className = '', id, ...props }: TextInputProps) {
  return (
    <div className={`ui-text-input ${className}`}>
      <label className="ui-text-input-label" htmlFor={id}>{label}</label>
      <input
        type="text"
        id={id}
        className="ui-text-input-field"
        {...props}
      />
    </div>
  );
}
