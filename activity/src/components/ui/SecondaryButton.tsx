import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  children: ReactNode;
  large?: boolean;
}

export function SecondaryButton({ icon, children, large, className = '', ...props }: SecondaryButtonProps) {
  return (
    <button className={`btn btn-secondary ${large ? 'btn-large' : ''} ${className}`} {...props}>
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}
