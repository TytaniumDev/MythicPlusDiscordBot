import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDiscordEmbedded } from './embedded';

afterEach(() => {
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('isDiscordEmbedded', () => {
  it('is false for a top-level page', () => {
    window.history.replaceState(null, '', '/?frame_id=1');
    expect(isDiscordEmbedded()).toBe(false);
  });

  it('needs both an iframe and the frame_id Discord appends', () => {
    vi.stubGlobal('top', {});
    expect(isDiscordEmbedded()).toBe(false);
    window.history.replaceState(null, '', '/?frame_id=1');
    expect(isDiscordEmbedded()).toBe(true);
  });
});
