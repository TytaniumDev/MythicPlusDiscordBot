import { useState, useCallback, useRef, useEffect } from 'react';
import { PlayerCard } from './PlayerCard';
import { getPrimaryRole } from '../lib/roles';
import type { WoWPlayer } from '../types';

interface MobilePlayerDrawerProps {
  player: WoWPlayer;
}

const ROLE_LABELS: Record<string, string> = {
  tank: 'Tank',
  healer: 'Healer',
  ranged: 'Ranged',
  melee: 'Melee',
};

export function MobilePlayerDrawer({ player }: MobilePlayerDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(() => setExpanded((v) => !v), []);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) setExpanded(false);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpanded(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [expanded]);

  const mainRole = getPrimaryRole(player);
  const offspecs = player.offspecs || [];

  return (
    <>
      {expanded && (
        <div
          className="drawer-backdrop"
          ref={backdropRef}
          onClick={handleBackdropClick}
        />
      )}
      <div className={`mobile-drawer ${expanded ? 'mobile-drawer--expanded' : ''}`}>
        <button
          className="mobile-drawer__header"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse player card' : 'Expand player card'}
        >
          <div className="mobile-drawer__info">
            <span className="mobile-drawer__name">{player.name}</span>
            <div className="mobile-drawer__chips">
              {mainRole !== 'unassigned' && (
                <span className={`mobile-drawer__chip mobile-drawer__chip--${mainRole}`}>
                  {ROLE_LABELS[mainRole] ?? mainRole}
                </span>
              )}
              {offspecs.map((os) => (
                <span key={os} className={`mobile-drawer__chip mobile-drawer__chip--${os} mobile-drawer__chip--offspec`}>
                  {ROLE_LABELS[os] ?? os}
                </span>
              ))}
            </div>
          </div>
          <span className="mobile-drawer__chevron" aria-hidden="true">
            {expanded ? '\u25BE' : '\u25B4'}
          </span>
        </button>
        {expanded && (
          <div className="mobile-drawer__body">
            <PlayerCard player={player} />
          </div>
        )}
      </div>
    </>
  );
}
