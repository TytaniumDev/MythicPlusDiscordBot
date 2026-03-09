import { type ReactNode, useCallback } from 'react';
import { StatusMessage } from './StatusMessage';

interface LayoutProps {
  children: ReactNode;
  onNavigateHome: () => void;
}

export function Layout({ children, onNavigateHome }: LayoutProps) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigateHome();
    }
  }, [onNavigateHome]);

  return (
    <div id="app">
      <header className="app-header">
        <h1
          role="button"
          tabIndex={0}
          aria-label="Return home or to lobby"
          onClick={onNavigateHome}
          onKeyDown={handleKeyDown}
        >
          Wheelson
        </h1>
        <a
          id="commit-link"
          className="commit-hash"
          target="_blank"
          rel="noopener noreferrer"
          href={`https://github.com/TytaniumDev/MythicPlusDiscordBot/commit/${__COMMIT_HASH__}`}
          aria-label={`View commit ${__COMMIT_HASH__} on GitHub`}
        >
          {__COMMIT_HASH__}
        </a>
      </header>

      <StatusMessage />

      {children}
    </div>
  );
}
