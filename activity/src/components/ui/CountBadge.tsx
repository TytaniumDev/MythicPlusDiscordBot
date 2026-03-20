interface CountBadgeProps {
  count: number;
  className?: string;
}

export function CountBadge({ count, className = '' }: CountBadgeProps) {
  return (
    <span className={`count-badge ${className}`}>
      {count}
    </span>
  );
}
