import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useIdentityResolver } from '../hooks/useIdentityResolver';
import { GroupCard } from '../components/GroupCard';
import { HeaderBar } from '../components/HeaderBar';
import { ConfirmBackDialog } from '../components/ConfirmBackDialog';
import { ReportBadGroupDialog } from '../components/ReportBadGroupDialog';
import { SpotlightPortraits } from '../components/SpotlightPortraits';
import { DungeonSuggestions } from '../components/DungeonSuggestions';
import { IconButton, SecondaryButton } from '../components/ui';
import { useDungeonSuggestions } from '../hooks/useDungeonSuggestions';
import { useDefaultKeyLevel } from '../hooks/useDefaultKeyLevel';
import { clampKeyLevel } from '../lib/keyLevel';
import { isCompleteGroup } from '../store/types';
import type { ViewName } from '../store/types';
import type { WoWPlayer } from '../types';
import { reportError } from '../lib/sentry';

const RotateIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
  </svg>
);

const FlagIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" />
  </svg>
);

interface ResultsViewProps {
  onNavigate: (view: ViewName, opts?: { replace?: boolean }) => void;
}

export function ResultsView({ onNavigate }: ResultsViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const currentPlayerId = useAppStore((s) => s.currentPlayerId);
  const service = useSessionService();
  const groups = useMemo(() => channelData?.groups || [], [channelData?.groups]);
  const players = channelData?.players || [];
  useIdentityResolver(players);

  const yourGroupIndex = useMemo(() => {
    if (!currentPlayerId) return -1;
    return groups.findIndex((g) => {
      if (g.tank?.discordId === currentPlayerId) return true;
      if (g.healer?.discordId === currentPlayerId) return true;
      return g.dps.some((p) => p?.discordId === currentPlayerId);
    });
  }, [groups, currentPlayerId]);
  const yourGroup = yourGroupIndex >= 0 ? groups[yourGroupIndex] : null;

  const yourGroupPlayers = useMemo(() => {
    if (!yourGroup) return [];
    return [yourGroup.tank, yourGroup.healer, ...yourGroup.dps].filter(
      (p): p is NonNullable<typeof p> => p != null,
    );
  }, [yourGroup]);

  const yourGroupHeading = yourGroup
    ? (isCompleteGroup(yourGroup) ? `Group ${yourGroupIndex + 1}` : 'Remainder')
    : 'Your Group';

  // Scope dungeon suggestions to the players actually in this group, so the
  // ranking reflects the people who are about to run a key — not unrelated
  // lobby members. Falls back to everyone placed in a complete group when
  // the viewer isn't in any group (spectator), so the panel still has
  // something useful to say.
  const suggestionsPlayers = useMemo<WoWPlayer[]>(() => {
    if (yourGroupPlayers.length > 0) return yourGroupPlayers;
    const grouped: WoWPlayer[] = [];
    for (const g of groups) {
      if (!isCompleteGroup(g)) continue;
      if (g.tank) grouped.push(g.tank);
      if (g.healer) grouped.push(g.healer);
      grouped.push(...g.dps);
    }
    return grouped;
  }, [yourGroupPlayers, groups]);
  // Seed from the persistent default once on mount; per-session changes from
  // the dropdown stay local — only the lobby writes the default back.
  const [defaultKeyLevel] = useDefaultKeyLevel();
  const [keyLevel, setKeyLevel] = useState<number>(defaultKeyLevel);
  const handleKeyLevelChange = useCallback((next: number) => {
    setKeyLevel(clampKeyLevel(next));
  }, []);
  const { state: dungeonSuggestionsState, scoresByDiscordId } =
    useDungeonSuggestions(suggestionsPlayers, keyLevel);

  const [showConfirmBack, setShowConfirmBack] = useState(false);
  const pendingBrowserBack = useAppStore((s) => s.pendingBrowserBack);

  useEffect(() => {
    if (pendingBrowserBack) setShowConfirmBack(true);
  }, [pendingBrowserBack]);

  const confirmBack = useCallback(async () => {
    setShowConfirmBack(false);
    useAppStore.getState().setPendingBrowserBack(false);
    try {
      await service.newRound();
      onNavigate('lobby');
    } catch (err) {
      reportError(err, { tag: 'ResultsView.newRound' });
      onNavigate('home');
    }
  }, [service, onNavigate]);

  const cancelBack = useCallback(() => {
    setShowConfirmBack(false);
    useAppStore.getState().setPendingBrowserBack(false);
  }, []);

  const [showReportDialog, setShowReportDialog] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);

  const handleNewRound = async () => {
    try {
      await service.newRound();
      onNavigate('lobby');
    } catch (err) {
      reportError(err, { tag: 'ResultsView.newRound' });
      useAppStore.getState().setStatusMessage('Failed to start new round. Please refresh.');
    }
  };

  const handleReportSubmit = useCallback(async (title: string, description: string) => {
    try {
      await service.reportBadGroup(title, description);
      setReportSubmitted(true);
      setTimeout(() => setReportSubmitted(false), 5000);
      setShowReportDialog(false);
    } catch (err) {
      reportError(err, { tag: 'ResultsView.reportBadGroup' });
      useAppStore.getState().setStatusMessage('Failed to submit report. Please try again.');
    }
  }, [service]);

  return (
    <div className="main-layout">
      <HeaderBar
        title="All Groups Formed!"
        titleColor="var(--color-gold)"
        onTitleClick={() => onNavigate('home')}
        className="app-header"
        extra={
          <IconButton
            icon={<FlagIcon />}
            label="Report bad group"
            onClick={() => setShowReportDialog(true)}
          />
        }
      />
      <main className="content-area">
        <section id="view-results">
          {yourGroupPlayers.length > 0 && (
            <div className="results-your-group">
              <h3 className="results-your-group__heading">{yourGroupHeading}</h3>
              <SpotlightPortraits
                players={yourGroupPlayers}
                scoresByDiscordId={scoresByDiscordId}
              />
            </div>
          )}
          <DungeonSuggestions
            {...dungeonSuggestionsState}
            layout="horizontal"
            keyLevel={keyLevel}
            onKeyLevelChange={handleKeyLevelChange}
          />
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
          <div className="results-actions">
            <SecondaryButton
              id="new-round-btn"
              large
              icon={<RotateIcon />}
              onClick={handleNewRound}
            >
              New Round
            </SecondaryButton>
            {reportSubmitted && (
              <p className="report-success" role="status">Report submitted. Thank you!</p>
            )}
          </div>
        </section>
      </main>
      {showConfirmBack && (
        <ConfirmBackDialog
          title="Leave Results?"
          message="This will end the current session and return everyone to the lobby."
          onConfirm={confirmBack}
          onCancel={cancelBack}
        />
      )}
      {showReportDialog && (
        <ReportBadGroupDialog
          onClose={() => setShowReportDialog(false)}
          onSubmit={handleReportSubmit}
        />
      )}
    </div>
  );
}
