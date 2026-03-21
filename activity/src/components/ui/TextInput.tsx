import { useId, type InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function TextInput({ label, className = '', id, ...props }: TextInputProps) {
  const autoId = useId();
  const inputId = id || autoId;
  return (
    <div className={`ui-text-input ${className}`}>
      <label className="ui-text-input-label" htmlFor={inputId}>{label}</label>
      <input
        type="text"
        id={inputId}
        className="ui-text-input-field"
        {...props}
      />
    </div>
  );
}
