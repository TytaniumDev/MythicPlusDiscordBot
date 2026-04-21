interface RoleRowProps {
  /** Role label shown in the row ("Tank", "Healer", "DPS"). */
  roleLabel: string;
  /** Player name (may include utility icons via `suffix`). */
  name: string;
  /** CSS variable or color string for the role indicator. */
  color: string;
  /** CSS class suffix for the role indicator ("tank", "healer", "dps"). Defaults to lowercased `roleLabel`. */
  roleClass?: string;
  /** Whether the player is filling this slot as an offspec. */
  isOffspec?: boolean;
  /** Compact variant hides the role label text. */
  compact?: boolean;
  /** Variant style: 'card' (default) or 'spotlight'. */
  variant?: 'card' | 'spotlight';
  /** Optional trailing content (e.g., utility icons). */
  suffix?: string;
}

export function RoleRow({
  roleLabel,
  name,
  color,
  roleClass,
  isOffspec = false,
  compact = false,
  variant = 'card',
  suffix = '',
}: RoleRowProps) {
  const rowClass =
    variant === 'spotlight'
      ? 'spotlight-role'
      : compact
        ? 'compact-role'
        : 'group-role';
  const indicatorClass = roleClass ?? roleLabel.toLowerCase();
  const ariaLabel = `${roleLabel}${isOffspec ? ' (offspec)' : ''}`;

  return (
    <div className={rowClass}>
      <span
        className={`role-indicator ${indicatorClass}${isOffspec ? ' offspec' : ''}`}
        style={isOffspec ? { borderColor: color } : { background: color }}
        role="img"
        aria-label={ariaLabel}
        title={ariaLabel}
      />
      {(variant === 'spotlight' || !compact) && (
        <span className="role-label">{roleLabel}</span>
      )}
      <span className="role-name">
        {name}
        {suffix}
      </span>
    </div>
  );
}
