import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface PrimaryCTAProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: ReactNode;
  children: ReactNode;
}

export function PrimaryCTA({ icon, children, className = '', ...props }: PrimaryCTAProps) {
  return (
    <button className={`btn btn-primary btn-large ${className}`} {...props}>
      {icon && <span className="btn-icon">{icon}</span>}
      {children}
    </button>
  );
}
