import { useAppStore } from '../store/store';
import { topAffinityFor } from '@mythicplus/shared';
import { HeaderBar } from '../components/HeaderBar';
import { HeaderProfileSlot } from '../components/HeaderProfileSlot';

export function ConnectionsView() {
  const currentPlayerName = useAppStore((s) => s.currentPlayerName);
  const seasonPairs = useAppStore((s) => s.seasonPairs);
  const setView = useAppStore((s) => s.setView);

  const counts = seasonPairs?.counts ?? {};
  const topTeammates = currentPlayerName
    ? topAffinityFor(currentPlayerName, counts, 5)
    : [];

  return (
    <div className="connections-view">
      <HeaderBar
        title="Connections"
        onBack={() => setView('lobby')}
        avatar={<HeaderProfileSlot />}
      />
      <main className="connections-view__body">
        <section>
          <h2 className="connections-view__heading">
            {currentPlayerName ? `Your top teammates` : 'Top teammates'}
          </h2>
          {topTeammates.length === 0 ? (
            <div className="connections-view__empty">
              {currentPlayerName
                ? 'No shared groups yet — spin together once first.'
                : 'Sign in to see your teammates.'}
            </div>
          ) : (
            <ol className="connections-view__list">
              {topTeammates.map((row) => (
                <li key={row.teammate}>
                  <span className="connections-view__name">{row.teammate}</span>
                  <span className="connections-view__count">{row.count}×</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  );
}
