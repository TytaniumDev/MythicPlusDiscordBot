import { useState } from 'react';
import { useAppStore } from '../store/store';
import { useIdentity } from '../hooks/useIdentity';
import { HeaderBar } from '../components/HeaderBar';
import { PrimaryCTA } from '../components/ui';
import type { WoWPlayer } from '../types';
import { toAvatarUrl } from '../lib/characterMedia';
import { remapImageUrl } from '../discordSdk';
import { getClassColor } from '../lib/classColors';

interface IdentityViewProps {
  onNavigate: (view: 'channels' | 'setup' | 'home', opts?: { replace?: boolean }) => void;
}

export function IdentityView({ onNavigate }: IdentityViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const claimedPlayers = channelData?.claimedPlayers ?? [];
  const players = channelData?.players ?? [];
  const { selectPlayer } = useIdentity();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (player: WoWPlayer) => {
    if (!player.discordId) return;
    setSelectedId(player.discordId);
  };

  const handleContinue = () => {
    const player = players.find(p => p.discordId === selectedId);
    if (!player) return;
    selectPlayer(player);
    onNavigate('setup', { replace: true });
  };

  if (players.length === 0) {
    return (
      <div className="main-layout">
        <HeaderBar
          title="Wheelson"
          subtitle="Join the voice channel to get started"
          onBack={() => onNavigate('channels')}
          onTitleClick={() => onNavigate('home')}
          className="app-header"
        />
        <main className="content-area">
          <section id="view-identity" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>Waiting for players to join voice...</p>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="main-layout">
      <HeaderBar
        title="Wheelson"
        subtitle={`${players.length} in voice`}
        onBack={() => onNavigate('channels')}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
      />
      <main className="content-area">
        <section id="view-identity">
          <div className="identity-picker">
            <h2 className="identity-picker__title">Select Your Name</h2>
            <p className="identity-picker__subtitle">Pick yourself from the voice channel</p>
            <div className="identity-grid">
              {players.map((player) => {
                const id = player.discordId ?? player.name;
                const isClaimed = player.discordId != null && claimedPlayers.includes(player.discordId);
                const isSelected = player.discordId === selectedId;
                const avatarUrl = remapImageUrl(toAvatarUrl(player.mediaUrl) ?? undefined);
                const ringColor = getClassColor(player.characterClass) ?? 'var(--color-gold)';
                return (
                  <button
                    key={id}
                    className={`identity-card${isSelected ? ' identity-card--selected' : ''}${isClaimed ? ' identity-card--claimed' : ''}`}
                    onClick={() => handleSelect(player)}
                    aria-label={isClaimed ? `${player.name} (claimed)` : `Select ${player.name}`}
                  >
                    <div
                      className="identity-card__avatar"
                      style={{ '--ic-ring': ringColor } as React.CSSProperties}
                    >
                      <span className="identity-card__avatar-letter">
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                      {avatarUrl && (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="identity-card__avatar-img"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      )}
                    </div>
                    <span className="identity-card__name">{player.name}</span>
                    {isSelected && <span className="identity-card__check">{'✓'}</span>}
                    {isClaimed && <span className="identity-card__claimed">Claimed</span>}
                  </button>
                );
              })}
            </div>
            <PrimaryCTA id="identity-continue-btn" disabled={!selectedId} onClick={handleContinue}>
              {'Continue →'}
            </PrimaryCTA>
            <p className="identity-picker__help">Not in the list? Join the voice channel first.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
