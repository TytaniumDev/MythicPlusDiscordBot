import { forwardRef, useImperativeHandle } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import { WheelsView } from './WheelsView';
import { useAppStore } from '../store/store';
import { mockChannelData, mockGroups, mockProfiles } from '../lib/mockData';
import { WHEEL_SPIN_DURATIONS } from '../lib/timing';
import type { WheelHandle } from '../components/Wheel';
import type { WheelsGridHandle, WheelsGridRef } from '../components/WheelsGrid';

interface FakeSpin {
  name: string;
  duration: number | undefined;
  land: () => void;
}

// Per-wheel spinTo calls, in the order they started. Each spin stays in
// flight until the test lands it.
const spins = vi.hoisted(() => new Map<number, FakeSpin[]>());
const markDotCompleted = vi.hoisted(() => vi.fn<(index: number) => void>());

vi.mock('../components/WheelsGrid', () => {
  const makeWheel = (index: number): WheelHandle => ({
    init: () => {},
    updateEntries: () => {},
    spinTo: (name, duration) =>
      new Promise<string>((resolve) => {
        const list = spins.get(index) ?? [];
        list.push({ name, duration, land: () => resolve(name) });
        spins.set(index, list);
      }),
    cancel: () => {},
    clearResult: () => {},
    setSpinning: () => {},
    element: null,
  });
  const wheels = [0, 1, 2, 3, 4].map(makeWheel);
  const grid: WheelsGridHandle = {
    tank: wheels[0],
    healer: wheels[1],
    dps1: wheels[2],
    dps2: wheels[3],
    dps3: wheels[4],
    orderedWheels: () => wheels,
    initWheels: () => {},
    clearAllResults: () => {},
    cancelAll: () => {},
    setAllSpinning: () => {},
    setCarouselSlide: () => {},
    markDotCompleted,
    resetCarouselDots: () => {},
  };
  return {
    WheelsGridComponent: forwardRef<WheelsGridRef>(function FakeWheelsGrid(_props, ref) {
      useImperativeHandle(ref, () => ({ grid }));
      return null;
    }),
  };
});

beforeEach(() => {
  vi.useFakeTimers();
  spins.clear();
  markDotCompleted.mockClear();
  // Narrow window: the carousel layout Discord's picture-in-picture shows.
  vi.stubGlobal('matchMedia', (media: string) => ({
    matches: true,
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  useAppStore.setState({ isDemoMode: true });
  const store = useAppStore.getState();
  store.setProfiles(mockProfiles);
  store.setChannelData({ ...mockChannelData, status: 'spinning', groups: mockGroups });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  useAppStore.getState().resetSession();
});

describe('WheelsView', () => {
  it('starts every wheel together in the carousel layout and ticks each dot as it lands', async () => {
    const { container } = render(<WheelsView onNavigate={() => {}} />);
    const spinButton = container.querySelector<HTMLButtonElement>('#next-btn');
    expect(spinButton).not.toBeNull();

    // The spin prompt fades out before it starts the spin.
    await act(async () => {
      fireEvent.click(spinButton!);
      await vi.advanceTimersByTimeAsync(1000);
    });

    const [group] = mockGroups;
    const winners = [group.tank, group.healer, ...group.dps];
    winners.forEach((winner, i) => {
      expect(spins.get(i)).toEqual([
        { name: winner!.name, duration: WHEEL_SPIN_DURATIONS[i], land: expect.any(Function) },
      ]);
    });
    expect(markDotCompleted).not.toHaveBeenCalled();

    await act(async () => {
      spins.get(0)![0].land();
    });
    expect(markDotCompleted).toHaveBeenCalledExactlyOnceWith(0);
  });
});
