import { useAppStore } from '../store/store';

export function StatusMessage() {
  const statusMessage = useAppStore((s) => s.statusMessage);
  const connectionLost = useAppStore((s) => s.connectionLost);

  return (
    <div id="status-message" aria-live="polite">
      {connectionLost ? 'Connection lost. Reconnecting…' : statusMessage}
    </div>
  );
}
