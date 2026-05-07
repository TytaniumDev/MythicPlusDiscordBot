import { useEffect, useRef, useCallback } from 'react';
import { WoWPlayer } from '../types';
import { SecondaryButton, PrimaryCTA } from './ui';

interface SpinWarningDialogProps {
  missingRole: WoWPlayer[];
  missingNameOnly: WoWPlayer[];
  missingCharacterLookup: WoWPlayer[];
  onGoBack: () => void;
  onSpinAnyway: () => void;
}

export function SpinWarningDialog({
  missingRole,
  missingNameOnly,
  missingCharacterLookup,
  onGoBack,
  onSpinAnyway,
}: SpinWarningDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onGoBack();
  }, [onGoBack]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onGoBack();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onGoBack]);

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="spin-warning" role="alertdialog" aria-label="Not everyone is ready">
        <div className="spin-warning__icon">&#x26A0;&#xFE0F;</div>
        <h3 className="spin-warning__title">Not Everyone Is Ready</h3>
        <p className="spin-warning__subtitle">Some players haven't finished setting up</p>

        {missingRole.length > 0 && (
          <div className="spin-warning__section spin-warning__section--error">
            <div className="spin-warning__section-label">Will be sat out (no role)</div>
            {missingRole.map(p => (
              <div key={p.discordId || p.name} className="spin-warning__player">
                <span>{p.name}</span>
                <span className="spin-warning__reason">no role set</span>
              </div>
            ))}
          </div>
        )}

        {missingNameOnly.length > 0 && (
          <div className="spin-warning__section spin-warning__section--warn">
            <div className="spin-warning__section-label">Missing WoW name (will use Discord name)</div>
            {missingNameOnly.map(p => (
              <div key={p.discordId || p.name} className="spin-warning__player">
                <span>{p.name}</span>
                <span className="spin-warning__reason">has role, no WoW name</span>
              </div>
            ))}
          </div>
        )}

        {missingCharacterLookup.length > 0 && (
          <div className="spin-warning__section spin-warning__section--warn">
            <div className="spin-warning__section-label">Character not found</div>
            {missingCharacterLookup.map(p => (
              <div key={p.discordId || p.name} className="spin-warning__player">
                <span>{p.name}</span>
                <span className="spin-warning__reason">
                  {`'${p.inGameName ?? ''}' didn't resolve — typo?`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="spin-warning__actions">
          <SecondaryButton onClick={onGoBack}>Go Back</SecondaryButton>
          <PrimaryCTA id="spin-anyway-btn" onClick={onSpinAnyway}>Spin Anyway</PrimaryCTA>
        </div>
      </div>
    </div>
  );
}
