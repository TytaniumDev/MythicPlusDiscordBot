import { useEffect, useCallback, useRef } from 'react';
import type { WoWPlayer } from '../types';
import { CharacterCard } from './CharacterCard';

interface CharacterCardModalProps {
  player: WoWPlayer;
  isSittingOut: boolean;
  onClose: () => void;
}

/**
 * Another player's character, opened from their lobby chip: the same card the
 * sidebar shows for the current user, as a dialog.
 */
export function CharacterCardModal({ player, isSittingOut, onClose }: CharacterCardModalProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  }, [onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="character-card-modal" role="dialog" aria-modal="true" aria-label={`Edit ${player.name}`}>
        <CharacterCard player={player} isSittingOut={isSittingOut} isSelf={false} onClose={onClose} />
      </div>
    </div>
  );
}
