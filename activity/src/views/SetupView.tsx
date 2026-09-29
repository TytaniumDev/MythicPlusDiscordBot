import { useMemo } from 'react';
import { useAppStore } from '../store/store';
import { HeaderBar } from '../components/HeaderBar';
import { HeaderProfileSlot } from '../components/HeaderProfileSlot';
import { CharacterHeader } from '../components/CharacterHeader';
import { Divider, PrimaryCTA } from '../components/ui';
import { RoleEditor } from '../components/RoleEditor';
import { getPrimaryRole, getRoleColor, isPlayerReady } from '../lib/roles';

interface SetupViewProps {
  onNavigate: (view: 'identity' | 'lobby' | 'home', opts?: { replace?: boolean }) => void;
}

export function SetupView({ onNavigate }: SetupViewProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const players = useAppStore((s) => s.players);

  const player = useMemo(
    () => players.find(p => p.discordId === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );

  if (!player) {
    return (
      <div className="main-layout">
        <HeaderBar
          title="Setup"
          subtitle="Player not found"
          onBack={() => onNavigate('identity')}
          onTitleClick={() => onNavigate('home')}
          className="app-header"
          avatar={<HeaderProfileSlot />}
        />
        <main className="content-area">
          <section id="view-setup" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-secondary)' }}>
              Your player was not found in the voice channel.
            </p>
            <button
              className="btn btn-secondary"
              style={{ marginTop: '1rem' }}
              onClick={() => onNavigate('identity')}
            >
              Go Back
            </button>
          </section>
        </main>
      </div>
    );
  }

  const primaryRole = getPrimaryRole(player);
  const color = getRoleColor(primaryRole);
  const ready = isPlayerReady(player);

  return (
    <div className="main-layout">
      <HeaderBar
        title="Setup"
        subtitle="Set up your character"
        onBack={() => onNavigate('identity')}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
        avatar={<HeaderProfileSlot />}
      />
      <main className="content-area">
        <section id="view-setup">
          <div className="setup-view">
            <CharacterHeader
              name={player.name}
              subtitle={player.inGameName || undefined}
              color={color}
              mediaUrl={player.mediaUrl}
            />
            <Divider />
            <div className="setup-view__form">
              <RoleEditor player={player} hideSitOut />
            </div>
            <PrimaryCTA
              id="setup-ready-btn"
              disabled={!ready}
              onClick={() => onNavigate('lobby', { replace: true })}
            >
              {ready ? "I'm Ready \u2192" : 'Enter WoW name & pick a role'}
            </PrimaryCTA>
          </div>
        </section>
      </main>
    </div>
  );
}
