import { describe, it, expect, vi } from 'vitest';
import { statusToView, routeToView, viewToRoute } from './routing';

describe('statusToView', () => {
  it('maps lobby/request_spin to lobby', () => {
    expect(statusToView('lobby')).toBe('lobby');
    expect(statusToView('request_spin')).toBe('lobby');
  });
  it('maps spinning to wheels', () => {
    expect(statusToView('spinning')).toBe('wheels');
  });
  it('maps completed to results', () => {
    expect(statusToView('completed')).toBe('results');
  });
  it('falls back to lobby and warns on unknown status', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(statusToView('bogus')).toBe('lobby');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('routeToView', () => {
  it('returns home for empty hash', () => {
    expect(routeToView('')).toEqual({ view: 'home', guildId: null });
    expect(routeToView('#/')).toEqual({ view: 'home', guildId: null });
  });
  it('parses guild views', () => {
    expect(routeToView('#/guild/abc-123/lobby')).toEqual({ view: 'lobby', guildId: 'abc-123' });
    expect(routeToView('#/guild/g1/wheels')).toEqual({ view: 'wheels', guildId: 'g1' });
    expect(routeToView('#/guild/g1/results')).toEqual({ view: 'results', guildId: 'g1' });
  });
  it('returns home for malformed paths', () => {
    expect(routeToView('#/guild//lobby')).toEqual({ view: 'home', guildId: null });
    expect(routeToView('#/guild/g1/unknown')).toEqual({ view: 'home', guildId: null });
    expect(routeToView('#garbage')).toEqual({ view: 'home', guildId: null });
  });
});

describe('viewToRoute', () => {
  it('returns root for home', () => {
    expect(viewToRoute('home')).toBe('#/');
    expect(viewToRoute('home', 'g1')).toBe('#/');
  });
  it('returns root when guild missing', () => {
    expect(viewToRoute('lobby', null)).toBe('#/');
    expect(viewToRoute('lobby')).toBe('#/');
  });
  it('builds guild routes', () => {
    expect(viewToRoute('lobby', 'g1')).toBe('#/guild/g1/lobby');
    expect(viewToRoute('wheels', 'g1')).toBe('#/guild/g1/wheels');
  });
  it('round-trips through routeToView', () => {
    const cases: Array<['lobby' | 'wheels' | 'results' | 'channels', string]> = [
      ['lobby', 'g1'],
      ['wheels', 'guild-2'],
      ['results', 'gg'],
      ['channels', 'xyz'],
    ];
    for (const [view, guild] of cases) {
      const route = viewToRoute(view, guild);
      expect(routeToView(route)).toEqual({ view, guildId: guild });
    }
  });
});
