import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useAppStore } from '../store/store';
import { useSessionService } from '../hooks/useSession';
import { useIdentityResolver } from '../hooks/useIdentityResolver';
import { useIsCarouselMode, useIsCompactPanel } from '../hooks/useMediaQuery';
import { WheelsGridComponent, type WheelsGridRef } from '../components/WheelsGrid';
import { GroupCard } from '../components/GroupCard';
import { MobileGroupPager } from '../components/MobileGroupPager';
import { HeaderBar } from '../components/HeaderBar';
import { ConfirmBackDialog } from '../components/ConfirmBackDialog';
import { PrimaryCTA } from '../components/ui';
import { isCompleteGroup } from '../store/types';
import { initPools } from '../lib/roles';
import { WheelEntry } from '../types';
import { audio } from '../lib/audio';
import { delay, CAROUSEL_SPIN_DURATION, CAROUSEL_ADVANCE_DELAY, GRID_SPIN_DURATION } from '../lib/timing';

interface WheelsViewProps {
  onNavigate: (view: 'lobby' | 'results' | 'home', opts?: { replace?: boolean }) => void;
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

  const players = channelData?.players || [];
  useIdentityResolver(players);
  const isCompact = useIsCompactPanel();
  const gridRef = useRef<WheelsGridRef>(null);

  const [wheelStatus, setWheelStatus] = useState('Calculating...');
  const [nextBtnVisible, setNextBtnVisible] = useState(false);
  const [nextBtnText, setNextBtnText] = useState('Spin for Group 1');
  const [nextBtnDisabled, setNextBtnDisabled] = useState(false);
  const [showConfirmBack, setShowConfirmBack] = useState(false);
  const pendingBrowserBack = useAppStore((s) => s.pendingBrowserBack);

  // Show confirmation dialog when browser back is intercepted
  useEffect(() => {
    if (pendingBrowserBack) setShowConfirmBack(true);
  }, [pendingBrowserBack]);

  const markedPools = useMemo(() => {
    if (poolTanks.length === 0 && poolHealers.length === 0 && poolDps.length === 0) return null;

    const chosenNames = new Set<string>();
    groupCards.forEach((c) => {
      if (c.group.tank) chosenNames.add(c.group.tank.name);
      if (c.group.healer) chosenNames.add(c.group.healer.name);
      c.group.dps.forEach((p) => {
        if (p) chosenNames.add(p.name);
      });
    });

    const mark = (entries: WheelEntry[]) =>
      entries.map((e) => ({ ...e, isChosen: chosenNames.has(e.name) }));

    return {
      tanks: mark(poolTanks),
      healers: mark(poolHealers),
      dps: mark(poolDps),
    };
  }, [poolTanks, poolHealers, poolDps, groupCards]);

  const pools = markedPools;

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

      gridRef.current?.grid?.resetCarouselDots();
      gridRef.current?.grid?.setCarouselSlide(0);

      setNextBtnVisible(true);
      setNextBtnText('Spin for Group 1');
      setNextBtnDisabled(false);
    }
  }, [channelData, spinSequenceStarted]);

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

    if (!markedPools) {
      store.setSpinAnimating(false);
      grid.isAnimating = false;
      return;
    }

    grid.setAllSpinning();
    grid.clearAllResults();
    grid.initWheels(markedPools);

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

    checkForPendingRevealsRef.current();
  }, [advanceAfterSpin, markedPools]);

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
    if (!markedPools) {
      store.setSpinAnimating(false);
      grid.isAnimating = false;
      return;
    }
    grid.setCarouselSlide(0);
    grid.initWheels(markedPools);
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
  }, [advanceAfterSpin, markedPools]);

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

  checkForPendingRevealsRef.current = checkForPendingReveals;

  const handleNextClick = useCallback(async () => {
    const store = useAppStore.getState();

    if (store.currentGroupIndex >= store.fullGroups.length) {
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

  const requestBack = useCallback(() => {
    if (isDemoMode) {
      handleCancel();
    } else {
      setShowConfirmBack(true);
    }
  }, [isDemoMode, handleCancel]);

  const confirmBack = useCallback(() => {
    setShowConfirmBack(false);
    useAppStore.getState().setPendingBrowserBack(false);
    handleCancel();
  }, [handleCancel]);

  const cancelBack = useCallback(() => {
    setShowConfirmBack(false);
    useAppStore.getState().setPendingBrowserBack(false);
  }, []);

  return (
    <div className="main-layout">
      <HeaderBar
        title={wheelStatus}
        onBack={requestBack}
        onTitleClick={() => onNavigate('home')}
        className="app-header"
      />
      <main className="content-area">
        <section id="view-wheels">
          <div className="wheels-content">
            <WheelsGridComponent ref={gridRef} pools={pools} />

            {!isCarousel && (
              <div id="side-column" className="side-column">
                <aside id="side-panel" className="side-panel">
                  <h3>Groups</h3>
                  <div id="groups-list">
                    {groupCards.map((card) => (
                      <GroupCard
                        key={card.index}
                        group={card.group}
                        index={card.index}
                        label={card.label}
                        hideEmpty={card.hideEmpty}
                        compact={isCompact}
                      />
                    ))}
                  </div>
                </aside>
              </div>
            )}
          </div>

          {isCarousel && (
            <MobileGroupPager groupCards={groupCards} />
          )}

          {nextBtnVisible && (
            <PrimaryCTA
              id="next-btn"
              disabled={nextBtnDisabled}
              onClick={handleNextClick}
            >
              {nextBtnText}
            </PrimaryCTA>
          )}
          {!nextBtnVisible && (
            <PrimaryCTA id="next-btn" className="hidden">
              Spin for Group 1
            </PrimaryCTA>
          )}
        </section>
      </main>
      {showConfirmBack && (
        <ConfirmBackDialog onConfirm={confirmBack} onCancel={cancelBack} />
      )}
    </div>
  );
}
