import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useIsBottomStrip } from './useMediaQuery';

interface MockMql {
  matches: boolean;
  addEventListener: () => void;
  removeEventListener: () => void;
}

function mockMatchMedia(matchersByQuery: Record<string, boolean>) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string): MockMql => ({
      matches: matchersByQuery[query] ?? false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('useIsBottomStrip', () => {
  beforeEach(() => {
    mockMatchMedia({});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true for portrait window above carousel breakpoint', () => {
    mockMatchMedia({
      '(min-width: 600px) and (max-aspect-ratio: 6/5)': true,
    });
    const { result } = renderHook(() => useIsBottomStrip());
    expect(result.current).toBe(true);
  });

  it('returns false for landscape window', () => {
    mockMatchMedia({
      '(min-width: 600px) and (max-aspect-ratio: 6/5)': false,
    });
    const { result } = renderHook(() => useIsBottomStrip());
    expect(result.current).toBe(false);
  });

  it('returns false for narrow window (carousel territory)', () => {
    mockMatchMedia({
      '(min-width: 600px) and (max-aspect-ratio: 6/5)': false,
    });
    const { result } = renderHook(() => useIsBottomStrip());
    expect(result.current).toBe(false);
  });
});
