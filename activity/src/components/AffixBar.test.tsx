import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { AffixBar } from './AffixBar';
import { useAppStore } from '../store/store';

describe('AffixBar', () => {
  afterEach(() => {
    cleanup();
    useAppStore.getState().setDemoMode(false);
  });

  it("is a region labeled by its heading, holding the week's affix link", () => {
    useAppStore.getState().setDemoMode(true);
    render(<AffixBar />);
    const region = screen.getByRole('region', { name: "This week's affix" });
    const link = within(region).getByRole('link', { name: /opens on Wowhead/ });
    expect(link.getAttribute('href')).toMatch(/^https:\/\/www\.wowhead\.com\//);
  });
});
