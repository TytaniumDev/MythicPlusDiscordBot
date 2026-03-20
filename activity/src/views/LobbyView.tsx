import { useState, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useIdentityResolver } from '../hooks/useIdentityResolver';
import { PlayerChip } from '../components/PlayerChip';
import { PlayerCard } from '../components/PlayerCard';
import { IdentitySelector } from '../components/IdentitySelector';
import { AffixBar } from '../components/AffixBar';
import { HeaderBar } from '../components/HeaderBar';
import { PrimaryCTA, RoleSectionHeader } from '../components/ui';
import { getPrimaryRole, hasAnyRole } from '../lib/roles';

const SpinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

interface LobbyViewProps {
  onNavigate: (view: 'channels' | 'wheels', opts?: { replace?: boolean }) => void;
}

export function LobbyView({ onNavigate }: LobbyViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const service = useSessionService();
  const players = channelData?.players || [];
  useIdentityResolver(players);

  const [isCalculating, setIsCalculating] = useState(false);

  const handleSpin = async () => {
    try {
      setIsCalculating(true);
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

  const sittingOut = channelData?.sittingOut ?? [];
  const activePlayers = players.filter(p => !p.discordId || !sittingOut.includes(p.discordId));
  const sittingOutPlayers = players.filter(p => p.discordId && sittingOut.includes(p.discordId));

  const tanks = activePlayers.filter((p) => getPrimaryRole(p) === 'tank');
  const healers = activePlayers.filter((p) => getPrimaryRole(p) === 'healer');
  const rangedPlayers = activePlayers.filter((p) => getPrimaryRole(p) === 'ranged');
  const meleePlayers = activePlayers.filter((p) => getPrimaryRole(p) === 'melee');
  const unassigned = activePlayers.filter((p) => !hasAnyRole(p));

  // Find the current player for PlayerCard
  const selectedPlayer = useMemo(() => {
    if (!currentPlayerId) return players[0] || null;
    return players.find(p => p.discordId === currentPlayerId) || players[0] || null;
  }, [currentPlayerId, players]);

  const playerCountText = players.length === 0
    ? '0 players'
    : activePlayers.length === 1
      ? '1 player'
      : `${activePlayers.length} players`;

  const subtitleText = sittingOutPlayers.length > 0
    ? `${playerCountText} (${sittingOutPlayers.length} sitting out)`
    : playerCountText;

  if (players.length === 0) {
    return (
      <div className="main-layout">
        <HeaderBar
          title="Players"
          subtitle="0 players"
          onBack={() => onNavigate('channels')}
          className="app-header"
        />
        <main className="content-area">
          <section id="view-lobby">
            <AffixBar />
            <div id="player-list">
              <div style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center' }}>
                Waiting for players to join voice...
              </div>
            </div>
            <span id="player-count" className="hidden">0 players</span>
            <PrimaryCTA id="spin-btn" disabled>
              Waiting for players...
            </PrimaryCTA>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="main-layout">
      <HeaderBar
        title="Players"
        subtitle={subtitleText}
        onBack={() => onNavigate('channels')}
        className="app-header"
      />
      <main className="content-area">
        <section id="view-lobby">
          <span id="player-count" className="hidden">{subtitleText}</span>

          <AffixBar />

          <div className="lobby-body">
            <div className="lobby-players">
              <div id="player-list">
                {/* Left column: Tank + Heal sections stacked */}
                <div className="role-column">
                  <div className="role-section">
                    <RoleSectionHeader label="Tanks" count={tanks.length} color="tank" />
                    {tanks.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
                  </div>
                  <div className="role-section">
                    <RoleSectionHeader label="Heal" count={healers.length} color="healer" />
                    {healers.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
                  </div>
                </div>

                {/* Right column: Ranged + Melee */}
                <div className="role-column role-column-dps">
                  <RoleSectionHeader label="Ranged" count={rangedPlayers.length} color="dps" />
                  <div className="dps-grid">
                    {rangedPlayers.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
                  </div>
                  <RoleSectionHeader label="Melee" count={meleePlayers.length} color="dps" />
                  <div className="dps-grid">
                    {meleePlayers.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
                  </div>
                </div>

                {/* Unassigned section */}
                {unassigned.length > 0 && (
                  <div className="role-section" style={{ gridColumn: '1 / -1' }}>
                    <RoleSectionHeader label="Unassigned" count={unassigned.length} color="unassigned" />
                    <div className="dps-grid">
                      {unassigned.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
                    </div>
                  </div>
                )}

                {/* Sitting Out section */}
                {sittingOutPlayers.length > 0 && (
                  <div className="role-section" style={{ gridColumn: '1 / -1' }}>
                    <RoleSectionHeader label="Sitting Out" count={sittingOutPlayers.length} color="sitting-out" />
                    <div className="sitting-out-grid">
                      {sittingOutPlayers.map((p) => <PlayerChip key={p.discordId || p.name} player={p} />)}
                    </div>
                  </div>
                )}
              </div>

              <IdentitySelector players={players} />
            </div>

            {selectedPlayer && (
              <div className="lobby-sidebar">
                <PlayerCard player={selectedPlayer} />
              </div>
            )}
          </div>

          <PrimaryCTA
            id="spin-btn"
            icon={<SpinIcon />}
            disabled={isCalculating}
            onClick={handleSpin}
          >
            {isCalculating ? 'Calculating...' : 'SPIN THE WHEEL!'}
          </PrimaryCTA>
        </section>
      </main>
    </div>
  );
}
