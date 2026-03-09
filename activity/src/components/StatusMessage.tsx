import { useAppStore } from '../store/store';

export function StatusMessage() {
  const statusMessage = useAppStore((s) => s.statusMessage);

  return (
    <div id="status-message" aria-live="polite">
      {statusMessage}
    </div>
  );
}
