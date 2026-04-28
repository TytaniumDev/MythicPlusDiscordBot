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
import { SpotlightCard } from '../components/SpotlightCard';
import { SpinPrompt } from '../components/SpinPrompt';
import { isCompleteGroup } from '../store/types';
import { initPools } from '../lib/roles';
import { WheelEntry } from '../types';
import { audio } from '../lib/audio';
import { reportError } from '../lib/sentry';
import {
  delay,
  CAROUSEL_SPIN_DURATION, CAROUSEL_ADVANCE_DELAY, GRID_SPIN_DURATIONS,
  SPOTLIGHT_HOLD_DURATION, SPOTLIGHT_ENTER_DURATION, SPOTLIGHT_EXIT_DURATION,
  WHEELS_FADE_DURATION, POST_LAND_PAUSE,
} from '../lib/timing';

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
  const [showSpinBtn, setShowSpinBtn] = useState(false);
  const [spinBtnDisabled, setSpinBtnDisabled] = useState(false);
  const [autoAdvanceRunning, setAutoAdvanceRunning] = useState(false);
  const [wheelsHidden, setWheelsHidden] = useState(false);
  const [spotlightGroup, setSpotlightGroup] = useState<{ group: import('../types').WoWGroup; index: number; label?: string } | null>(null);
  const [spotlightVisible, setSpotlightVisible] = useState(false);
  const [spotlightExit, setSpotlightExit] = useState(false);
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

  const channelStatus = channelData?.status;
  const groupsCount = channelData?.groups?.length ?? 0;
  const isStaticWheel = channelData?.staticWheel === true;

  useEffect(() => {
    const data = useAppStore.getState().channelData;
    if (!data || data.status !== 'spinning') return;

    if (data.staticWheel) {
      const p = initPools(data.players);
      useAppStore.getState().setPools(p.tanks, p.healers, p.dps);
      setWheelStatus('Static preview');
      setShowSpinBtn(false);
      return;
    }

    if (data.groups && data.groups.length > 0 && !spinSequenceStarted) {
      const full = data.groups.filter(isCompleteGroup);
      const remainder = data.groups.filter((g) => !isCompleteGroup(g));
      useAppStore.getState().setSpinState(full, remainder);
      useAppStore.getState().setSpinSequenceStarted(true);
      useAppStore.getState().setCurrentGroupIndex(0);
      useAppStore.getState().clearGroupCards();

      const p = initPools(data.players);
      useAppStore.getState().setPools(p.tanks, p.healers, p.dps);

      gridRef.current?.grid?.resetCarouselDots();
      gridRef.current?.grid?.setCarouselSlide(0);

      setShowSpinBtn(true);
      setWheelStatus('Ready to spin!');
    }
  }, [channelStatus, groupsCount, isStaticWheel, spinSequenceStarted]);

  useEffect(() => {
    if (!channelData || !spinSequenceStarted) return;
    const store = useAppStore.getState();
    const revealed = channelData.revealedGroups ?? 0;
    const totalFull = store.fullGroups.length;

    if (revealed >= totalFull && !autoAdvanceRunning && !store.isSpinAnimating) {
      if (store.groupCards.length >= totalFull) return;
      if (store.currentGroupIndex >= totalFull) {
        onNavigate('results', { replace: true });
        service.finishSequence().catch((err) => {
          reportError(err, { tag: 'WheelsView.finishSequenceEffect' });
        });
        return;
      }
      runAutoAdvanceLoop().catch((err) => {
        reportError(err, { tag: 'WheelsView.autoAdvanceEffect' });
      });
    }
  }, [channelData?.revealedGroups, spinSequenceStarted, autoAdvanceRunning]);

  const autoAdvanceRef = useRef(false);

  const spinOneGroupGrid = useCallback(async (groupIndex: number) => {
    const grid = gridRef.current?.grid;
    if (!grid) return;
    const store = useAppStore.getState();
    const group = store.fullGroups[groupIndex];
    if (!group || !markedPools) return;

    grid.setAllSpinning(true);
    grid.clearAllResults();
    grid.initWheels(markedPools);

    const wheels = grid.orderedWheels();
    const winners = [group.tank, group.healer, ...group.dps];
    const spinPromises: Promise<string>[] = [];
    winners.forEach((winner, i) => {
      if (winner && wheels[i]) {
        spinPromises.push(wheels[i].spinTo(winner.name, GRID_SPIN_DURATIONS[i]));
      }
    });

    await Promise.all(spinPromises);
  }, [markedPools]);

  const spinOneGroupCarousel = useCallback(async (groupIndex: number) => {
    const grid = gridRef.current?.grid;
    if (!grid) return;
    const store = useAppStore.getState();
    const group = store.fullGroups[groupIndex];
    if (!group || !markedPools) return;

    grid.clearAllResults();
    grid.setCarouselSlide(0);
    grid.initWheels(markedPools);
    grid.resetCarouselDots();

    const wheels = grid.orderedWheels();
    const winners = [group.tank, group.healer, group.dps[0] || null, group.dps[1] || null, group.dps[2] || null];

    for (let slideIndex = 0; slideIndex < wheels.length; slideIndex++) {
      const wheel = wheels[slideIndex];
      const winner = winners[slideIndex];
      if (!winner) continue;

      grid.setCarouselSlide(slideIndex);
      wheel.setSpinning(true);

      await delay(350);
      await wheel.spinTo(winner.name, CAROUSEL_SPIN_DURATION);

      grid.markDotCompleted(slideIndex);
      await delay(CAROUSEL_ADVANCE_DELAY);
    }
  }, [markedPools]);

  const runAutoAdvanceLoop = useCallback(async () => {
    const store = useAppStore.getState();
    const grid = gridRef.current?.grid;
    if (!grid || autoAdvanceRef.current) return;

    autoAdvanceRef.current = true;
    setAutoAdvanceRunning(true);
    setShowSpinBtn(false);
    store.setSpinAnimating(true);

    const totalFull = store.fullGroups.length;
    const isCarouselMode = grid.isCarouselMode();

    for (let i = 0; i < totalFull; i++) {
      if (!autoAdvanceRef.current) break;

      store.setCurrentGroupIndex(i);
      setWheelStatus(`Spinning for Group ${i + 1}...`);

      // Fade wheels in (skip for first group — already visible)
      if (i > 0) {
        setWheelsHidden(false);
        await delay(WHEELS_FADE_DURATION);
      }

      // Spin wheels
      if (isCarouselMode) {
        await spinOneGroupCarousel(i);
      } else {
        await spinOneGroupGrid(i);
      }

      // Post-land pause
      setWheelStatus(`Group ${i + 1} Formed!`);
      await delay(POST_LAND_PAUSE);

      // Fade out wheels
      setWheelsHidden(true);
      await delay(WHEELS_FADE_DURATION);

      // Show spotlight card
      const group = store.fullGroups[i];
      setSpotlightGroup({ group, index: i });
      setSpotlightExit(false);
      setSpotlightVisible(true);
      audio.victory();
      await delay(SPOTLIGHT_ENTER_DURATION);

      // Hold spotlight
      await delay(SPOTLIGHT_HOLD_DURATION);

      // Exit spotlight
      setSpotlightVisible(false);
      setSpotlightExit(true);
      await delay(SPOTLIGHT_EXIT_DURATION);

      // Add to group cards and hide spotlight
      store.addGroupCard({ group, index: i });
      setSpotlightGroup(null);
      setSpotlightExit(false);

    }

    // Show remainder groups with spotlight cards (no wheel spin)
    for (let ri = 0; ri < store.remainderGroups.length; ri++) {
      if (!autoAdvanceRef.current) break;

      const rg = store.remainderGroups[ri];
      const rgIndex = totalFull + ri;

      setSpotlightGroup({ group: rg, index: rgIndex, label: 'Remainder' });
      setSpotlightExit(false);
      setSpotlightVisible(true);
      audio.victory();
      await delay(SPOTLIGHT_ENTER_DURATION);

      await delay(SPOTLIGHT_HOLD_DURATION);

      setSpotlightVisible(false);
      setSpotlightExit(true);
      await delay(SPOTLIGHT_EXIT_DURATION);

      store.addGroupCard({ group: rg, index: rgIndex, label: 'Remainder', hideEmpty: true });
      setSpotlightGroup(null);
      setSpotlightExit(false);
    }

    // Sequence complete — transition to results
    store.setCurrentGroupIndex(totalFull);
    store.setSpinAnimating(false);
    autoAdvanceRef.current = false;
    setAutoAdvanceRunning(false);

    await delay(300);
    onNavigate('results', { replace: true });
    try {
      await service.finishSequence();
    } catch (err) {
      reportError(err, { tag: 'WheelsView.finishSequence' });
    }
  }, [spinOneGroupGrid, spinOneGroupCarousel, onNavigate, service]);

  const handleSpinClick = useCallback(async () => {
    const store = useAppStore.getState();
    if (store.isSpinAnimating || autoAdvanceRunning) return;

    setSpinBtnDisabled(true);
    setShowSpinBtn(false);

    if (store.isDemoMode) {
      runAutoAdvanceLoop().catch((err) => {
        reportError(err, { tag: 'WheelsView.demoAdvance' });
        setShowSpinBtn(true);
        setSpinBtnDisabled(false);
      });
      return;
    }

    try {
      await service.revealAllGroups();
    } catch (err) {
      reportError(err, { tag: 'WheelsView.revealAllGroups' });
      setWheelStatus('Failed to spin. Please try again.');
      setShowSpinBtn(true);
      setSpinBtnDisabled(false);
    }
  }, [service, autoAdvanceRunning, runAutoAdvanceLoop]);

  const handleCancel = useCallback(async () => {
    autoAdvanceRef.current = false;
    setAutoAdvanceRunning(false);
    onNavigate('lobby');
    gridRef.current?.grid?.cancelAll();
    useAppStore.getState().resetSpinState();
    try {
      await service.cancelToLobby();
    } catch (err) {
      reportError(err, { tag: 'WheelsView.cancelToLobby' });
    }
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
            <div style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <div className={`wheels-area-fade${wheelsHidden ? ' wheels-hidden' : ''}`}>
                <WheelsGridComponent ref={gridRef} pools={pools} />
              </div>

              {spotlightGroup && (
                <div className="spotlight-overlay">
                  <SpotlightCard
                    group={spotlightGroup.group}
                    index={spotlightGroup.index}
                    visible={spotlightVisible}
                    exit={spotlightExit}
                    label={spotlightGroup.label}
                  />
                </div>
              )}
            </div>

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

          {showSpinBtn && (
            <SpinPrompt disabled={spinBtnDisabled} onSpin={handleSpinClick} />
          )}
        </section>
      </main>
      {showConfirmBack && (
        <ConfirmBackDialog onConfirm={confirmBack} onCancel={cancelBack} />
      )}
    </div>
  );
}
