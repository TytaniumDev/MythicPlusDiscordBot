import { useState } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useIdentityResolver } from '../hooks/useIdentityResolver';
import { PlayerChip } from '../components/PlayerChip';
import { PlayerModal } from '../components/PlayerModal';
import { IdentitySelector } from '../components/IdentitySelector';
import { getPrimaryRole, hasAnyRole } from '../lib/roles';

const BackArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
);

interface LobbyViewProps {
  onNavigate: (view: 'channels' | 'wheels', opts?: { replace?: boolean }) => void;
}

export function LobbyView({ onNavigate }: LobbyViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const service = useSessionService();
  const players = channelData?.players || [];
  useIdentityResolver(players);

  const [isCalculating, setIsCalculating] = useState(false);

  const handleSpin = async () => {
    try {
      setIsCalculating(true);
      // In demo mode, navigate immediately then simulate
      if (useAppStore.getState().isDemoMode) {
        onNavigate('wheels');
      }
      await service.requestSpin();
    } catch {
      useAppStore.getState().setStatusMessage('Spin request failed. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  if (players.length === 0) {
    return (
      <div className="main-layout">
        <main className="content-area">
          <section id="view-lobby">
            <div className="lobby-header">
              <button className="btn btn-back" aria-label="Change voice channel" onClick={() => onNavigate('channels')}>
                <BackArrow />
              </button>
              <div className="lobby-header-center">
                <h2>Players</h2>
                <span id="player-count" className="player-count">0 players</span>
              </div>
              <div className="lobby-header-spacer" aria-hidden="true" />
            </div>
            <div id="player-list">
              <div style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center' }}>
                Waiting for players to join voice...
              </div>
            </div>
            <button id="spin-btn" className="btn btn-primary btn-large" disabled>
              Waiting for players...
            </button>
          </section>
        </main>
      </div>
    );
  }

  const sittingOut = channelData?.sittingOut ?? [];
  const activePlayers = players.filter(p => !p.discordId || !sittingOut.includes(p.discordId));
  const sittingOutPlayers = players.filter(p => p.discordId && sittingOut.includes(p.discordId));

  // Group active players by main role
  const tanks = activePlayers.filter((p) => getPrimaryRole(p) === 'tank');
  const healers = activePlayers.filter((p) => getPrimaryRole(p) === 'healer');
  const rangedPlayers = activePlayers.filter((p) => getPrimaryRole(p) === 'ranged');
  const meleePlayers = activePlayers.filter((p) => getPrimaryRole(p) === 'melee');
  const unassigned = activePlayers.filter((p) => !hasAnyRole(p));

  return (
    <div className="main-layout">
      <main className="content-area">
        <section id="view-lobby">
          <div className="lobby-header">
            <button className="btn btn-back" aria-label="Change voice channel" onClick={() => onNavigate('channels')}>
              <BackArrow />
            </button>
            <div className="lobby-header-center">
              <h2>Players</h2>
              <span id="player-count" className="player-count">
                {activePlayers.length === 1 ? '1 player' : `${activePlayers.length} players`}
                {sittingOutPlayers.length > 0 && ` (${sittingOutPlayers.length} sitting out)`}
              </span>
            </div>
            <div className="lobby-header-spacer" aria-hidden="true" />
          </div>

          <div id="player-list">
            {/* Left column: Tank + Heal sections stacked */}
            <div className="role-column">
              <div className="role-section">
                <div className="role-column-header tank">{`Tank (${tanks.length})`}</div>
                {tanks.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
              </div>
              <div className="role-section">
                <div className="role-column-header healer">{`Heal (${healers.length})`}</div>
                {healers.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
              </div>
            </div>

            {/* Right column: Ranged + Melee */}
            <div className="role-column role-column-dps">
              <div className="role-column-header dps">{`Ranged (${rangedPlayers.length})`}</div>
              <div className="dps-grid">
                {rangedPlayers.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
              </div>
              <div className="role-column-header dps">{`Melee (${meleePlayers.length})`}</div>
              <div className="dps-grid">
                {meleePlayers.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
              </div>
            </div>

            {/* Unassigned section */}
            {unassigned.length > 0 && (
              <div className="role-section" style={{ gridColumn: '1 / -1' }}>
                <div className="role-column-header unassigned">{`Unassigned (${unassigned.length})`}</div>
                <div className="dps-grid">
                  {unassigned.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
                </div>
              </div>
            )}

            {/* Sitting Out section */}
            {sittingOutPlayers.length > 0 && (
              <div className="role-section" style={{ gridColumn: '1 / -1' }}>
                <div className="role-column-header sitting-out">{`Sitting Out (${sittingOutPlayers.length})`}</div>
                <div className="dps-grid">
                  {sittingOutPlayers.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
                </div>
              </div>
            )}
          </div>

          <IdentitySelector players={players} />

          <PlayerModal players={players} />

          <button
            id="spin-btn"
            className="btn btn-primary btn-large"
            disabled={isCalculating}
            onClick={handleSpin}
          >
            {isCalculating ? 'Calculating...' : 'SPIN THE WHEEL!'}
          </button>
        </section>
      </main>
    </div>
  );
}
