import { useState, type ReactNode } from 'react';
import { RoleSectionHeader } from './ui';
import { useIsCarouselMode } from '../hooks/useMediaQuery';

interface CollapsibleRoleSectionProps {
  label: string;
  count: number;
  color: 'tank' | 'healer' | 'dps' | 'unassigned' | 'sitting-out';
  children: ReactNode;
  defaultCollapsed?: boolean;
}

export function CollapsibleRoleSection({
  label,
  count,
  color,
  children,
  defaultCollapsed = false,
}: CollapsibleRoleSectionProps) {
  const isMobile = useIsCarouselMode();
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  if (!isMobile) {
    return (
      <>
        <RoleSectionHeader label={label} count={count} color={color} />
        {children}
      </>
    );
  }

  return (
    <>
      <button
        className={`role-section-header role-section-header--${color} role-section-header--collapsible`}
        onClick={() => setCollapsed((v) => !v)}
        aria-expanded={!collapsed}
      >
        <span className="role-section-header__label">{label}</span>
        <span className="role-section-header__count">({count})</span>
        <span className="role-section-header__chevron" aria-hidden="true">
          {collapsed ? '▸' : '▾'}
        </span>
      </button>
      {!collapsed && children}
    </>
  );
}
