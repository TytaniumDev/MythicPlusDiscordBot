import { useEffect, useRef, useCallback, useState } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useIsCarouselMode, useIsCompactPanel } from '../hooks/useMediaQuery';
import { WheelsGridComponent, type WheelsGridRef } from '../components/WheelsGrid';
import { GroupCard } from '../components/GroupCard';
import { isCompleteGroup } from '../store/types';
import { initPools } from '../lib/roles';
import { audio } from '../lib/audio';
import { delay, CAROUSEL_SPIN_DURATION, CAROUSEL_ADVANCE_DELAY, GRID_SPIN_DURATION } from '../lib/timing';

const BackArrow = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
);

interface WheelsViewProps {
  onNavigate: (view: 'lobby' | 'results', opts?: { replace?: boolean }) => void;
}

export function WheelsView({ onNavigate }: WheelsViewProps) {
  const channelData = useAppStore((s) => s.channelData);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const spinSequenceStarted = useAppStore((s) => s.spinSequenceStarted);
  const groupCards = useAppStore((s) => s.groupCards);
  const poolTanks = useAppStore((s) => s.poolTanks);
  const poolHealers = useAppStore((s) => s.poolHealers);
  const poolDps = useAppStore((s) => s.poolDps);

  const service = useSessionService();
  const isCarousel = useIsCarouselMode();
  const isCompact = useIsCompactPanel();
  const gridRef = useRef<WheelsGridRef>(null);

  const [wheelStatus, setWheelStatus] = useState('Calculating...');
  const [nextBtnVisible, setNextBtnVisible] = useState(false);
  const [nextBtnText, setNextBtnText] = useState('Spin for Group 1');
  const [nextBtnDisabled, setNextBtnDisabled] = useState(false);
  const [announceChecked, setAnnounceChecked] = useState(channelData?.announceResults !== false);

  // Sync local checkbox state when Firestore announceResults changes
  useEffect(() => {
    setAnnounceChecked(channelData?.announceResults !== false);
  }, [channelData?.announceResults]);

  const pools = poolTanks.length > 0 || poolHealers.length > 0 || poolDps.length > 0
    ? { tanks: poolTanks, healers: poolHealers, dps: poolDps }
    : null;

  // Start spin sequence when groups arrive
  useEffect(() => {
    if (!channelData || channelData.status !== 'spinning') return;

    if ((channelData as unknown as Record<string, unknown>).staticWheel) {
      const p = initPools(channelData.players);
      useAppStore.getState().setPools(p.tanks, p.healers, p.dps);
      setWheelStatus('Static preview');
      setNextBtnVisible(false);
      return;
    }

    if (channelData.groups && channelData.groups.length > 0 && !spinSequenceStarted) {
      const full = channelData.groups.filter(isCompleteGroup);
      const remainder = channelData.groups.filter((g) => !isCompleteGroup(g));
      useAppStore.getState().setSpinState(full, remainder);
      useAppStore.getState().setSpinSequenceStarted(true);
      useAppStore.getState().setCurrentGroupIndex(0);
      useAppStore.getState().clearGroupCards();

      const p = initPools(channelData.players);
      useAppStore.getState().setPools(p.tanks, p.healers, p.dps);

      // Reset carousel
      gridRef.current?.grid?.resetCarouselDots();
      gridRef.current?.grid?.setCarouselSlide(0);

      setNextBtnVisible(true);
      setNextBtnText('Spin for Group 1');
      setNextBtnDisabled(false);
    }
  }, [channelData, spinSequenceStarted]);

  // Process Firestore-driven revealed groups
  useEffect(() => {
    if (!channelData || isDemoMode || !spinSequenceStarted) return;
    const revealed = channelData.revealedGroups ?? 0;
    const idx = useAppStore.getState().currentGroupIndex;
    const animating = useAppStore.getState().isSpinAnimating;

    if (revealed > idx && !animating) {
      if (revealed > idx + 1) {
        catchUpRevealedGroups(revealed);
      } else {
        runSpinAnimation();
      }
    }
  }, [channelData?.revealedGroups, isDemoMode, spinSequenceStarted]);

  // Force redraw when entering view
  useEffect(() => {
    requestAnimationFrame(() => {
      gridRef.current?.grid?.forceRedraw();
    });
  }, []);

  const catchUpRevealedGroups = useCallback((count: number) => {
    const store = useAppStore.getState();
    const groups = store.fullGroups;
    for (let i = store.currentGroupIndex; i < count && i < groups.length; i++) {
      store.addGroupCard({ group: groups[i], index: i });
    }
    const newIndex = Math.min(count, groups.length);
    store.setCurrentGroupIndex(newIndex);

    if (newIndex >= groups.length && store.remainderGroups.length > 0) {
      store.remainderGroups.forEach((rg, i) => {
        store.addGroupCard({ group: rg, index: groups.length + i, label: 'Remainder', hideEmpty: true });
      });
    }

    updateNextButton(newIndex, groups.length);
  }, []);

  const updateNextButton = useCallback((idx: number, totalFull: number) => {
    setNextBtnVisible(true);
    if (idx >= totalFull) {
      setNextBtnText('Finish');
      setNextBtnDisabled(false);
    } else {
      setNextBtnText(`Spin for Group ${idx + 1}`);
      setNextBtnDisabled(false);
    }
  }, []);

  const advanceAfterSpin = useCallback((idx: number) => {
    const store = useAppStore.getState();
    const newIdx = idx + 1;
    store.setCurrentGroupIndex(newIdx);

    if (newIdx >= store.fullGroups.length && store.remainderGroups.length > 0) {
      store.remainderGroups.forEach((rg, i) => {
        store.addGroupCard({ group: rg, index: store.fullGroups.length + i, label: 'Remainder', hideEmpty: true });
      });
    }

    updateNextButton(newIdx, store.fullGroups.length);
  }, [updateNextButton]);

  // Ref to hold the latest checkForPendingReveals, breaking the circular
  // dependency between spin callbacks and checkForPendingReveals.
  const checkForPendingRevealsRef = useRef<() => void>(() => {});

  const spinForCurrentGroupGrid: () => Promise<void> = useCallback(async () => {
    const grid = gridRef.current?.grid;
    if (!grid) return;
    const store = useAppStore.getState();
    const idx = store.currentGroupIndex;
    const group = store.fullGroups[idx];
    if (!group) return;

    store.setSpinAnimating(true);
    grid.isAnimating = true;
    setNextBtnDisabled(true);
    setWheelStatus(`Spinning for Group ${idx + 1}...`);

    grid.setAllSpinning();
    grid.clearAllResults();
    grid.initWheels({ tanks: store.poolTanks, healers: store.poolHealers, dps: store.poolDps });

    const spinPromises: Promise<string>[] = [];
    if (group.tank) spinPromises.push(grid.tank.spinTo(group.tank.name, GRID_SPIN_DURATION));
    if (group.healer) spinPromises.push(grid.healer.spinTo(group.healer.name, GRID_SPIN_DURATION));

    const dpsWheels = [grid.dps1, grid.dps2, grid.dps3];
    const dpsDurations = [GRID_SPIN_DURATION, GRID_SPIN_DURATION + 300, GRID_SPIN_DURATION + 600];
    group.dps.forEach((dpsPlayer, i) => {
      if (dpsWheels[i]) spinPromises.push(dpsWheels[i].spinTo(dpsPlayer.name, dpsDurations[i]));
    });

    try {
      await Promise.all(spinPromises);
    } catch {
      store.setSpinAnimating(false);
      return;
    }

    grid.clearSpinningState();
    grid.isAnimating = false;
    audio.victory();

    setWheelStatus(`Group ${idx + 1} Formed!`);
    store.addGroupCard({ group, index: idx });
    store.setSpinAnimating(false);
    advanceAfterSpin(idx);

    // Check for pending reveals
    checkForPendingRevealsRef.current();
  }, [advanceAfterSpin]);

  const spinForCurrentGroupCarousel: () => Promise<void> = useCallback(async () => {
    const grid = gridRef.current?.grid;
    if (!grid) return;
    const store = useAppStore.getState();
    const idx = store.currentGroupIndex;
    const group = store.fullGroups[idx];
    if (!group) return;

    store.setSpinAnimating(true);
    grid.isAnimating = true;
    setNextBtnDisabled(true);
    setWheelStatus(`Spinning for Group ${idx + 1}...`);

    grid.clearAllResults();
    grid.initWheels({ tanks: store.poolTanks, healers: store.poolHealers, dps: store.poolDps });
    grid.resetCarouselDots();

    const wheels = grid.orderedWheels();
    const winners = [group.tank, group.healer, group.dps[0] || null, group.dps[1] || null, group.dps[2] || null];

    try {
      for (let slideIndex = 0; slideIndex < wheels.length; slideIndex++) {
        const wheel = wheels[slideIndex];
        const winner = winners[slideIndex];
        if (!winner) continue;

        grid.setCarouselSlide(slideIndex);
        const slot = grid.getSlot(slideIndex);
        slot?.classList.add('spinning');

        await delay(350);
        await wheel.spinTo(winner.name, CAROUSEL_SPIN_DURATION);

        slot?.classList.remove('spinning');
        grid.markDotCompleted(slideIndex);
        await delay(CAROUSEL_ADVANCE_DELAY);
      }
    } catch {
      store.setSpinAnimating(false);
      return;
    }

    grid.isAnimating = false;
    audio.victory();

    setWheelStatus(`Group ${idx + 1} Formed!`);
    store.addGroupCard({ group, index: idx });
    store.setSpinAnimating(false);
    advanceAfterSpin(idx);

    checkForPendingRevealsRef.current();
  }, [advanceAfterSpin]);

  const runSpinAnimation: () => Promise<void> = useCallback(async () => {
    const grid = gridRef.current?.grid;
    if (!grid) return;
    const store = useAppStore.getState();
    if (store.isSpinAnimating || store.currentGroupIndex >= store.fullGroups.length) return;

    if (grid.isCarouselMode()) {
      await spinForCurrentGroupCarousel();
    } else {
      await spinForCurrentGroupGrid();
    }
  }, [spinForCurrentGroupGrid, spinForCurrentGroupCarousel]);

  const checkForPendingReveals: () => void = useCallback(() => {
    const store = useAppStore.getState();
    if (!store.channelData || store.isDemoMode) return;
    const revealed = store.channelData.revealedGroups ?? 0;
    if (revealed > store.currentGroupIndex && !store.isSpinAnimating) {
      if (revealed > store.currentGroupIndex + 1) {
        catchUpRevealedGroups(revealed);
      } else {
        runSpinAnimation();
      }
    }
  }, [catchUpRevealedGroups, runSpinAnimation]);

  // Keep the ref in sync with the latest checkForPendingReveals
  checkForPendingRevealsRef.current = checkForPendingReveals;

  const handleNextClick = useCallback(async () => {
    const store = useAppStore.getState();

    if (store.currentGroupIndex >= store.fullGroups.length) {
      // Finish
      onNavigate('results', { replace: true });
      await service.finishSequence();
      return;
    }

    if (store.isSpinAnimating) return;

    if (store.isDemoMode) {
      if (isCarousel) {
        await spinForCurrentGroupCarousel();
      } else {
        await spinForCurrentGroupGrid();
      }
      return;
    }

    // Live mode: write to Firestore
    setNextBtnDisabled(true);
    try {
      await service.revealGroup(store.currentGroupIndex);
    } catch (err) {
      console.error('[Wheelson] Failed to reveal group:', err);
      setWheelStatus('Failed to spin. Please try again.');
      setNextBtnDisabled(false);
    }
  }, [service, onNavigate, isCarousel, spinForCurrentGroupCarousel, spinForCurrentGroupGrid]);

  const handleCancel = useCallback(async () => {
    onNavigate('lobby');
    gridRef.current?.grid?.cancelAll();
    useAppStore.getState().resetSpinState();
    await service.cancelToLobby();
  }, [service, onNavigate]);

  const handleAnnounceChange = useCallback(async (checked: boolean) => {
    setAnnounceChecked(checked);
    if (!isDemoMode) {
      try {
        await service.updateAnnounce(checked);
      } catch (err) {
        console.error('[Wheelson] Failed to update announce setting:', err);
      }
    }
  }, [isDemoMode, service]);

  return (
    <div className="main-layout">
      <main className="content-area">
        <section id="view-wheels">
          <div className="wheels-header">
            <button id="wheels-back-btn" className="btn btn-back" aria-label="Back to lobby" onClick={handleCancel}>
              <BackArrow />
            </button>
            <div id="wheel-status" className="wheel-status">{wheelStatus}</div>
            <div className="wheels-header-spacer" aria-hidden="true" />
          </div>

          <div className="wheels-content">
            <WheelsGridComponent ref={gridRef} pools={pools} />

            <div id="side-column" className="side-column">
              <aside id="side-panel" className="side-panel">
                <h3>Groups</h3>
                <div id="groups-list">
                  {groupCards.map((card, i) => (
                    <GroupCard
                      key={i}
                      group={card.group}
                      index={card.index}
                      label={card.label}
                      hideEmpty={card.hideEmpty}
                      compact={isCompact}
                    />
                  ))}
                </div>
              </aside>
              <label className="announce-option">
                <input
                  type="checkbox"
                  id="announce-checkbox"
                  checked={announceChecked}
                  onChange={(e) => handleAnnounceChange(e.target.checked)}
                />
                <span>Post results to chat</span>
              </label>
            </div>
          </div>

          {nextBtnVisible && (
            <button
              id="next-btn"
              className="btn btn-primary btn-large"
              disabled={nextBtnDisabled}
              onClick={handleNextClick}
            >
              {nextBtnText}
            </button>
          )}
          {/* Hidden ghost button so #next-btn always exists in the DOM for Playwright test selectors */}
          {!nextBtnVisible && (
            <button id="next-btn" className="btn btn-primary btn-large hidden">
              Spin for Group 1
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
