interface CharacterHeaderProps {
  name: string;
  subtitle?: string;
  color?: string;
  imageUrl?: string | null;
}

export function CharacterHeader({ name, subtitle, color = 'var(--color-tank)', imageUrl }: CharacterHeaderProps) {
  return (
    <div className="character-header" style={{ '--ch-color': color } as React.CSSProperties}>
      <div className="character-header__avatar">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`${name} character model`}
            className="character-header__img"
          />
        ) : (
          <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke={`${color}54`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </div>
      <div className="character-header__name">{name}</div>
      {subtitle && (
        <div className="character-header__class" style={{ color }}>{subtitle}</div>
      )}
    </div>
  );
}
