import { useEffect, useRef, useCallback } from 'react';
import { SecondaryButton, PrimaryCTA } from './ui';

interface CancelRollDialogProps {
  isInitiator: boolean;
  canCancelDirectly: boolean;
  onGoBack: () => void;
  onConfirmCancel: () => void;
}

export function CancelRollDialog({
  isInitiator,
  canCancelDirectly,
  onGoBack,
  onConfirmCancel
}: CancelRollDialogProps) {
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

  const title = isInitiator ? 'Cancel the Roll?' : 'Interrupt the Roll?';

  let description = '';
  if (isInitiator) {
    description = 'Are you sure you want to cancel? This will return everyone to the lobby and reset any sitting-out status.';
  } else if (canCancelDirectly) {
    description = 'You are not the person who started this roll. Canceling will revert the activity for EVERYONE. Are you sure you want to do this?';
  } else {
    description = 'Someone else started this roll. To prevent accidental interruptions, only the initiator can cancel for the first 2 minutes unless there is an issue.';
  }

  return (
    <div className="edit-modal-backdrop" ref={backdropRef} onClick={handleBackdropClick}>
      <div className="spin-warning" role="alertdialog" aria-label={title}>
        <div className="spin-warning__icon">🛑</div>
        <h3 className="spin-warning__title">{title}</h3>
        <p className="spin-warning__subtitle" style={{ marginBottom: '1.5rem' }}>{description}</p>

        <div className="spin-warning__actions">
          <SecondaryButton onClick={onGoBack}>Keep Rolling</SecondaryButton>
          {(isInitiator || canCancelDirectly) && (
            <PrimaryCTA
              id="confirm-cancel-btn"
              onClick={onConfirmCancel}
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 2px 12px rgba(239, 68, 68, 0.3)' }}
            >
              Cancel Roll
            </PrimaryCTA>
          )}
        </div>
      </div>
    </div>
  );
}
