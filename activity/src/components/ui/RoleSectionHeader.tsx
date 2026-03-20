import type { ReactNode } from 'react';

interface RoleSectionHeaderProps {
  icon?: ReactNode;
  label: string;
  count: number;
  color: 'tank' | 'healer' | 'dps' | 'unassigned' | 'sitting-out';
  className?: string;
}

export function RoleSectionHeader({ icon, label, count, color, className = '' }: RoleSectionHeaderProps) {
  return (
    <div className={`role-section-header role-section-header--${color} ${className}`}>
      {icon && <span className="role-section-header__icon">{icon}</span>}
      <span className="role-section-header__label">{label}</span>
      <span className="role-section-header__count">({count})</span>
    </div>
  );
}
