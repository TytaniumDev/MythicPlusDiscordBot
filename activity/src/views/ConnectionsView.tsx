import { useState, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { topAffinityFor, shortestPath } from '@mythicplus/shared';
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

  const allNames = useMemo(() => {
    const set = new Set<string>();
    for (const key of Object.keys(counts)) {
      const sep = key.indexOf('|');
      if (sep === -1) continue;
      set.add(key.slice(0, sep));
      set.add(key.slice(sep + 1));
    }
    return [...set].sort();
  }, [counts]);

  const [target, setTarget] = useState<string>('');
  const path = useMemo(() => {
    if (!currentPlayerName || !target) return null;
    return shortestPath(currentPlayerName, target, counts);
  }, [currentPlayerName, target, counts]);

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

        <section className="connections-view__six-degrees">
          <h2 className="connections-view__heading">Six degrees</h2>
          <p className="connections-view__sub">
            Find the shortest pair-history chain to any teammate.
          </p>
          <select
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="connections-view__select"
          >
            <option value="">Pick a player…</option>
            {allNames.filter((n) => n !== currentPlayerName).map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          {target && (
            path
              ? (
                <div className="connections-view__path">
                  {path.map((name, i) => (
                    <span key={i} className="connections-view__node">
                      {name}
                      {i < path.length - 1 && <span className="connections-view__arrow"> → </span>}
                    </span>
                  ))}
                </div>
              )
              : <div className="connections-view__empty">No shared groups yet — spin together once first.</div>
          )}
        </section>
      </main>
    </div>
  );
}
