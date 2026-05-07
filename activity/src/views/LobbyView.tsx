import { useState, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { reportError } from '../lib/sentry';
import { PlayerChip } from '../components/PlayerChip';
import { PlayerCard } from '../components/PlayerCard';
import { EditPlayerModal } from '../components/EditPlayerModal';
import { SpinWarningDialog } from '../components/SpinWarningDialog';
import { HeaderBar } from '../components/HeaderBar';
import { HeaderProfileSlot } from '../components/HeaderProfileSlot';
import { PrimaryCTA, RoleSectionHeader } from '../components/ui';
import { CollapsibleRoleSection } from '../components/CollapsibleRoleSection';
import { getPrimaryRole, hasAnyRole, getReadyCount, categorizeUnreadyPlayers, formatRoleName, getRoleTags, isPlayerReady } from '../lib/roles';
import { useIsMobileLobby } from '../hooks/useMediaQuery';
import { MobilePlayerDrawer } from '../components/MobilePlayerDrawer';

const SpinIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

interface LobbyViewProps {
  onNavigate: (view: 'channels' | 'wheels' | 'home', opts?: { replace?: boolean }) => void;
}

export function LobbyView({ onNavigate }: LobbyViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const service = useSessionService();
  const players = channelData?.players || [];

  const isMobile = useIsMobileLobby();
  const [isCalculating, setIsCalculating] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<typeof players[number] | null>(null);
  const [showSpinWarning, setShowSpinWarning] = useState(false);

  const currentPlayerId = useAppStore((s) => s.currentPlayerId);

  const sittingOut = channelData?.sittingOut ?? [];

  const handleSpinClick = () => {
    const { missingRole, missingNameOnly } = categorizeUnreadyPlayers(players, sittingOut);
    if (missingRole.length > 0 || missingNameOnly.length > 0) {
      setShowSpinWarning(true);
    } else {
      doSpin();
    }
  };

  const doSpin = async () => {
    setShowSpinWarning(false);
    try {
      setIsCalculating(true);

      // Auto-sit-out players missing a role.
      // Each toggleSitOut runs its own Firestore transaction (read+write
      // round trip), so issuing them in parallel converts O(N) latency to
      // O(1). The underlying writes use commutative arrayUnion ops, so
      // there's no ordering hazard.
      const { missingRole } = categorizeUnreadyPlayers(players, sittingOut);
      await Promise.all(
        missingRole
          .filter((p) => p.discordId && !sittingOut.includes(p.discordId))
          .map((p) => service.toggleSitOut(p.discordId!)),
      );

      if (useAppStore.getState().isDemoMode) {
        onNavigate('wheels');
      }
      await service.requestSpin();
    } catch (err) {
      reportError(err, { tag: 'LobbyView.requestSpin' });
      useAppStore.getState().setStatusMessage('Spin request failed. Please try again.');
    } finally {
      setIsCalculating(false);
    }
  };

  const activePlayers = players.filter(p => !p.discordId || !sittingOut.includes(p.discordId));
  const sittingOutPlayers = players.filter(p => p.discordId && sittingOut.includes(p.discordId));

  const tanks = activePlayers.filter((p) => getPrimaryRole(p) === 'tank');
  const healers = activePlayers.filter((p) => getPrimaryRole(p) === 'healer');
  const rangedPlayers = activePlayers.filter((p) => getPrimaryRole(p) === 'ranged');
  const meleePlayers = activePlayers.filter((p) => getPrimaryRole(p) === 'melee');
  const unassigned = activePlayers.filter((p) => !hasAnyRole(p));

  const myPlayer = useMemo(
    () => players.find(p => p.discordId === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );

  const { ready, total } = getReadyCount(players, sittingOut);
  const allReady = ready === total && total > 0;
  const readyText = `${ready}/${total} Ready`;

  const unreadyBreakdown = useMemo(
    () => categorizeUnreadyPlayers(players, sittingOut),
    [players, sittingOut],
  );

  const isSelfPlayer = (p: typeof players[number]): boolean =>
    currentPlayerId != null && p.discordId === currentPlayerId;

  const handleChipClick = (player: typeof players[number]) => {
    if (!isSelfPlayer(player)) {
      setEditingPlayer(player);
    }
  };

  const renderChip = (p: typeof players[number]) => {
    const roleKey = getPrimaryRole(p);
    const isSelf = isSelfPlayer(p);
    const isSittingOut = p.discordId != null && sittingOut.includes(p.discordId);
    return (
      <PlayerChip
        key={p.discordId || p.name}
        name={p.name}
        roleKey={roleKey}
        roleLabel={formatRoleName(roleKey)}
        tags={getRoleTags(p)}
        isSelected={isSelf}
        isSittingOut={isSittingOut}
        isReady={isPlayerReady(p)}
        mediaUrl={p.mediaUrl}
        characterClass={p.characterClass}
        onClick={() => handleChipClick(p)}
        ariaLabel={isSelf ? `Your character: ${p.name}` : `Edit ${p.name} roles`}
      />
    );
  };

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
          onTitleClick={() => onNavigate('home')}
          className="app-header"
          subtitleId="player-count"
          avatar={<HeaderProfileSlot />}
        />
        <main className="content-area">
          <section id="view-lobby">
            <div id="player-list">
              <div style={{ color: 'var(--text-secondary)', gridColumn: '1 / -1', textAlign: 'center' }}>
                Waiting for players to join voice...
              </div>
            </div>
            <PrimaryCTA id="spin-btn" disabled>
              Waiting for players...
            </PrimaryCTA>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className={`main-layout${isMobile ? ' mobile-lobby' : ''}`}>
      <HeaderBar
        title="Players"
        subtitle={subtitleText}
        onBack={() => onNavigate('channels')}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
        subtitleId="player-count"
        extra={
          <span className={`ready-badge ${allReady ? 'ready-badge--all' : 'ready-badge--partial'}`}>
            {readyText}
          </span>
        }
        avatar={<HeaderProfileSlot />}
      />
      <main className="content-area">
        <section id="view-lobby">

          <div className="lobby-body">
            <div className="lobby-players">
              <div id="player-list">
                {/* Left column: Tank + Heal sections stacked */}
                <div className="role-column">
                  <div className="role-section">
                    <CollapsibleRoleSection label="Tanks" count={tanks.length} color="tank">
                      {tanks.map(renderChip)}
                    </CollapsibleRoleSection>
                  </div>
                  <div className="role-section">
                    <CollapsibleRoleSection label="Heal" count={healers.length} color="healer">
                      {healers.map(renderChip)}
                    </CollapsibleRoleSection>
                  </div>
                </div>

                {/* Right column: Ranged + Melee */}
                <div className="role-column role-column-dps">
                  <CollapsibleRoleSection label="Ranged" count={rangedPlayers.length} color="dps">
                    <div className="dps-grid">
                      {rangedPlayers.map(renderChip)}
                    </div>
                  </CollapsibleRoleSection>
                  <CollapsibleRoleSection label="Melee" count={meleePlayers.length} color="dps">
                    <div className="dps-grid">
                      {meleePlayers.map(renderChip)}
                    </div>
                  </CollapsibleRoleSection>
                </div>

                {/* Unassigned section */}
                {unassigned.length > 0 && (
                  <div className="role-section" style={{ gridColumn: '1 / -1' }}>
                    <RoleSectionHeader label="Unassigned" count={unassigned.length} color="unassigned" />
                    <div className="dps-grid">
                      {unassigned.map(renderChip)}
                    </div>
                  </div>
                )}

                {/* Sitting Out section */}
                {sittingOutPlayers.length > 0 && (
                  <div className="role-section" style={{ gridColumn: '1 / -1' }}>
                    <RoleSectionHeader label="Sitting Out" count={sittingOutPlayers.length} color="sitting-out" />
                    <div className="sitting-out-grid">
                      {sittingOutPlayers.map(renderChip)}
                    </div>
                  </div>
                )}
              </div>

            </div>

            {!isMobile && myPlayer && (
              <div className="lobby-sidebar">
                <PlayerCard player={myPlayer} />
              </div>
            )}
          </div>

          {!isMobile && (
            <PrimaryCTA
              id="spin-btn"
              icon={<SpinIcon />}
              disabled={isCalculating}
              onClick={handleSpinClick}
            >
              {isCalculating ? 'Calculating...' : 'SPIN THE WHEEL!'}
            </PrimaryCTA>
          )}
        </section>
      </main>

      {isMobile && myPlayer && <MobilePlayerDrawer player={myPlayer} />}
      {isMobile && (
        <div className="mobile-spin-btn">
          <PrimaryCTA
            id="spin-btn"
            icon={<SpinIcon />}
            disabled={isCalculating}
            onClick={handleSpinClick}
          >
            {isCalculating ? 'Calculating...' : 'SPIN THE WHEEL!'}
          </PrimaryCTA>
        </div>
      )}
      {editingPlayer && (
        <EditPlayerModal
          player={editingPlayer}
          onClose={() => setEditingPlayer(null)}
        />
      )}
      {showSpinWarning && (
        <SpinWarningDialog
          missingRole={unreadyBreakdown.missingRole}
          missingNameOnly={unreadyBreakdown.missingNameOnly}
          onGoBack={() => setShowSpinWarning(false)}
          onSpinAnyway={doSpin}
        />
      )}
    </div>
  );
}
