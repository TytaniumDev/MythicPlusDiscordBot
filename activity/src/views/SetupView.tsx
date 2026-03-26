import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { HeaderBar } from '../components/HeaderBar';
import { CharacterHeader } from '../components/CharacterHeader';
import { Divider, PrimaryCTA } from '../components/ui';
import { RoleEditor } from '../components/RoleEditor';
import { getPrimaryRole, isPlayerReady } from '../lib/roles';

const ROLE_COLOR_MAP: Record<string, string> = {
  tank: 'var(--color-tank)',
  healer: 'var(--color-healer)',
  ranged: 'var(--color-dps)',
  melee: 'var(--color-dps)',
  unassigned: 'var(--text-secondary)',
};

interface SetupViewProps {
  onNavigate: (view: 'identity' | 'lobby' | 'home', opts?: { replace?: boolean }) => void;
}

export function SetupView({ onNavigate }: SetupViewProps) {
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const channelData = useAppStore((s) => s.channelData);
  const players = channelData?.players ?? [];

  const player = useMemo(
    () => players.find(p => p.discordId === currentPlayerId) ?? null,
    [players, currentPlayerId],
  );

  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  useEffect(() => {
    setMediaUrl(player?.mediaUrl ?? null);
  }, [player?.discordId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!player) {
    return (
      <div className="main-layout">
        <HeaderBar
          title="Setup"
          subtitle="Player not found"
          onBack={() => onNavigate('identity')}
          onTitleClick={() => onNavigate('home')}
          className="app-header"
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
  const color = ROLE_COLOR_MAP[primaryRole] ?? ROLE_COLOR_MAP.unassigned;
  const ready = isPlayerReady(player);

  return (
    <div className="main-layout">
      <HeaderBar
        title="Setup"
        subtitle="Set up your character"
        onBack={() => onNavigate('identity')}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
      />
      <main className="content-area">
        <section id="view-setup">
          <div className="setup-view">
            <CharacterHeader
              name={player.name}
              subtitle={player.inGameName || undefined}
              color={color}
              imageUrl={mediaUrl}
            />
            <Divider />
            <div className="setup-view__form">
              <RoleEditor
                player={player}
                onMediaUrlChange={setMediaUrl}
                hideSitOut
              />
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
