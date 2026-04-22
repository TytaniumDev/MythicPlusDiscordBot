import type { CharacterClass } from '@mythicplus/shared';
import { type RoleTag, getRoleColor } from '../lib/roles';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';

const ReadyIcon = () => (
  <svg className="ready-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const NotReadyIcon = () => (
  <svg className="not-ready-x" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export interface PlayerChipProps {
  name: string;
  roleKey: string;
  roleLabel: string;
  tags?: RoleTag[];
  isSelected?: boolean;
  isSittingOut?: boolean;
  isReady?: boolean;
  mediaUrl?: string | null;
  characterClass?: CharacterClass | null;
  onClick?: () => void;
  ariaLabel?: string;
}

function ChipPortrait({ name, roleKey, mediaUrl, characterClass }: {
  name: string;
  roleKey: string;
  mediaUrl?: string | null;
  characterClass?: CharacterClass | null;
}) {
  const ringColor = getClassColor(characterClass) ?? getRoleColor(roleKey);
  const avatarUrl = toAvatarUrl(mediaUrl);
  const proxied = remapImageUrl(avatarUrl ?? undefined);

  return (
    <div
      className="player-chip__portrait"
      style={{ '--pc-ring': ringColor } as React.CSSProperties}
      aria-hidden="true"
    >
      {proxied ? (
        <img
          src={proxied}
          alt=""
          className="player-chip__portrait-img"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <span className="player-chip__portrait-letter">{name.charAt(0).toUpperCase() || '?'}</span>
      )}
    </div>
  );
}

export function PlayerChip({
  name,
  roleKey,
  roleLabel,
  tags = [],
  isSelected = false,
  isSittingOut = false,
  isReady = false,
  mediaUrl,
  characterClass,
  onClick,
  ariaLabel,
}: PlayerChipProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick?.();
    }
  };

  return (
    <div
      className={`player-chip${isSelected ? ' is-selected' : ''}${isSittingOut ? ' sitting-out' : ''}${!isReady && !isSittingOut ? ' not-ready' : ''}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel ?? `Edit ${name} roles`}
      title={roleLabel}
    >
      {isReady && <ReadyIcon />}
      {!isReady && !isSittingOut && <NotReadyIcon />}
      <ChipPortrait
        name={name}
        roleKey={roleKey}
        mediaUrl={mediaUrl}
        characterClass={characterClass}
      />
      <div className="player-chip__body">
        <span className="player-chip__name">{name}</span>
        {tags.length > 0 && (
          <div className="chip-tags">
            {tags.map((tag, i) => (
              <span key={i} className={`role-tag ${tag.cssClass}`}>
                {tag.label}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
