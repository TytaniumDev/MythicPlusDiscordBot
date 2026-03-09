import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { GroupCard } from '../components/GroupCard';
import type { WoWGroup } from '../types';

function isCompleteGroup(group: WoWGroup): boolean {
  return group.tank !== null && group.healer !== null && group.dps.length === 3;
}

interface ResultsViewProps {
  onNavigate: (view: 'lobby', opts?: { replace?: boolean }) => void;
}

export function ResultsView({ onNavigate: _onNavigate }: ResultsViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const service = useSessionService();
  const groups = channelData?.groups || [];

  const handleNewRound = async () => {
    try {
      await service.newRound();
    } catch (err) {
      console.error('[Wheelson] Failed to start new round:', err);
      useAppStore.getState().setStatusMessage('Failed to start new round. Please refresh.');
    }
  };

  return (
    <div className="main-layout">
      <main className="content-area">
        <section id="view-results">
          <h2>All Groups Formed!</h2>
          <div id="final-groups">
            {groups.map((g, i) => {
              const remainder = !isCompleteGroup(g);
              return (
                <GroupCard
                  key={i}
                  group={g}
                  index={i}
                  label={remainder ? 'Remainder' : undefined}
                  hideEmpty={remainder}
                />
              );
            })}
          </div>
          <button
            id="new-round-btn"
            className="btn btn-secondary btn-large"
            onClick={handleNewRound}
          >
            New Round
          </button>
        </section>
      </main>
    </div>
  );
}
