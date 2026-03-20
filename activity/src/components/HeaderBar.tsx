import type { ReactNode } from 'react';
import { IconButton } from './ui';

const BackArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
);

interface HeaderBarProps {
  title: string;
  subtitle?: string;
  subtitleId?: string;
  onBack?: () => void;
  onTitleClick?: () => void;
  titleColor?: string;
  /** Extra content rendered after the title area */
  extra?: ReactNode;
  className?: string;
}

export function HeaderBar({
  title,
  subtitle,
  subtitleId,
  onBack,
  onTitleClick,
  titleColor,
  extra,
  className = '',
}: HeaderBarProps) {
  return (
    <header className={`header-bar ${className}`}>
      {onBack ? (
        <IconButton
          icon={<BackArrow />}
          label="Go back"
          className="header-bar__back"
          onClick={onBack}
        />
      ) : (
        <div className="header-bar__back-spacer" />
      )}

      <img
        src="/Wheelson.png"
        alt=""
        className="header-bar__icon"
        onClick={onTitleClick}
        style={{ cursor: onTitleClick ? 'pointer' : undefined }}
      />

      <div className="header-bar__center">
        <div
          className="header-bar__title"
          style={titleColor ? { color: titleColor } : undefined}
        >
          {title}
        </div>
        {subtitle && (
          <div id={subtitleId} className="header-bar__subtitle">{subtitle}</div>
        )}
      </div>

      <div className="header-bar__right">
        {extra}
        <a
          className="header-bar__hash"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://github.com/TytaniumDev/MythicPlusDiscordBot/commit/${__COMMIT_HASH__}`}
          aria-label={`View commit ${__COMMIT_HASH__} on GitHub`}
        >
          {__COMMIT_HASH__}
        </a>
      </div>
    </header>
  );
}
