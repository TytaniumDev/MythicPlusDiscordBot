import { useState, useEffect, useCallback, useRef } from 'react';
import { WoWPlayer } from '../types';
import { getPrimaryRole, getRoleColor } from '../lib/roles';
import { CharacterHeader } from './CharacterHeader';
import { Divider } from './ui';
import { RoleEditor } from './RoleEditor';

interface EditPlayerModalProps {
  player: WoWPlayer;
  onClose: () => void;
}

export function EditPlayerModal({ player, onClose }: EditPlayerModalProps) {
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMediaUrl(player.mediaUrl ?? null);
  }, [player.discordId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const color = getRoleColor(getPrimaryRole(player));

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="edit-modal" role="dialog" aria-label={`Edit ${player.name}`}>
        <button className="edit-modal__close" onClick={onClose} aria-label="Close">✕</button>
        <CharacterHeader
          name={player.name}
          subtitle={player.inGameName || undefined}
          color={color}
          imageUrl={mediaUrl}
        />
        <Divider />
        <div className="edit-modal__form">
          <RoleEditor player={player} onMediaUrlChange={setMediaUrl} />
        </div>
      </div>
    </div>
  );
}
