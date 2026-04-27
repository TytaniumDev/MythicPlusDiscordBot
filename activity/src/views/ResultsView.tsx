import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useIdentityResolver } from '../hooks/useIdentityResolver';
import { GroupCarousel, type GroupCarouselItem } from '../components/GroupCarousel';
import { HeaderBar } from '../components/HeaderBar';
import { ConfirmBackDialog } from '../components/ConfirmBackDialog';
import { ReportBadGroupDialog } from '../components/ReportBadGroupDialog';
import { DungeonSuggestions } from '../components/DungeonSuggestions';
import { IconButton, PrimaryCTA } from '../components/ui';
import { useDungeonSuggestions } from '../hooks/useDungeonSuggestions';
import { clampKeyLevel, computeSuggestedKeyLevel, KEY_LEVEL_DEFAULT } from '../lib/keyLevel';
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

  const initialSlide = Math.max(0, yourGroupIndex);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(initialSlide);
  useEffect(() => {
    // Reseed when the viewer's group changes (e.g., late identity resolution).
    if (yourGroupIndex >= 0) setActiveSlideIndex(yourGroupIndex);
    // Intentionally omit activeSlideIndex from deps so manual nav isn't overridden.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [yourGroupIndex]);

  const carouselItems = useMemo<GroupCarouselItem[]>(() => {
    return groups.map((g, i) => ({
      group: g,
      index: i,
      label: isCompleteGroup(g) ? undefined : 'Remainder',
    }));
  }, [groups]);

  const activeGroup = groups[activeSlideIndex];
  const activeSlideIsComplete = activeGroup ? isCompleteGroup(activeGroup) : false;

  const activeGroupPlayers = useMemo<WoWPlayer[]>(() => {
    if (!activeGroup) return [];
    const out: WoWPlayer[] = [];
    if (activeGroup.tank) out.push(activeGroup.tank);
    if (activeGroup.healer) out.push(activeGroup.healer);
    out.push(...activeGroup.dps);
    return out;
  }, [activeGroup]);

  const [keyLevel, setKeyLevel] = useState<number>(KEY_LEVEL_DEFAULT);
  const [userOverrode, setUserOverrode] = useState(false);
  const handleKeyLevelChange = useCallback((next: number) => {
    setKeyLevel(clampKeyLevel(next));
    setUserOverrode(true);
  }, []);
  const { state: dungeonSuggestionsState, scoresByDiscordId } =
    useDungeonSuggestions(activeGroupPlayers, keyLevel);

  // Seed the dropdown from group median-of-medians + 1 once Raider.io data
  // resolves. After the user picks a level explicitly, leave it alone.
  const suggestedKeyLevel = useMemo(() => {
    const perPlayerLevels: number[][] = [];
    for (const p of activeGroupPlayers) {
      if (!p.discordId) continue;
      const scores = scoresByDiscordId.get(p.discordId);
      if (!scores) continue;
      const levels = Object.values(scores.byDungeon)
        .map((r) => r.level)
        .filter((l) => l > 0);
      perPlayerLevels.push(levels);
    }
    return computeSuggestedKeyLevel(perPlayerLevels);
  }, [activeGroupPlayers, scoresByDiscordId]);

  useEffect(() => {
    if (userOverrode) return;
    if (suggestedKeyLevel == null) return;
    setKeyLevel(suggestedKeyLevel);
  }, [suggestedKeyLevel, userOverrode]);

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
          <PrimaryCTA
            id="new-round-btn"
            className="results-new-round"
            icon={<RotateIcon />}
            onClick={handleNewRound}
            aria-label="New Round"
          >
            <span className="btn-label">New Round</span>
          </PrimaryCTA>
          {carouselItems.length > 0 && (
            <GroupCarousel
              items={carouselItems}
              activeIndex={activeSlideIndex}
              onActiveIndexChange={setActiveSlideIndex}
              scoresByDiscordId={scoresByDiscordId}
            />
          )}
          <div
            key={activeSlideIndex}
            className="results-suggestions-fade"
          >
            {activeSlideIsComplete ? (
              <DungeonSuggestions
                {...dungeonSuggestionsState}
                layout="horizontal"
                keyLevel={keyLevel}
                onKeyLevelChange={handleKeyLevelChange}
              />
            ) : (
              <div className="results-suggestions-empty" role="status">
                Suggested Keys unavailable for incomplete groups.
              </div>
            )}
          </div>
          {reportSubmitted && (
            <div className="results-actions">
              <p className="report-success" role="status">Report submitted. Thank you!</p>
            </div>
          )}
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
