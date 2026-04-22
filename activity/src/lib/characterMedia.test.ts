import { describe, it, expect } from 'vitest';
import { toAvatarUrl, toMainBodyUrl } from './characterMedia';

describe('toAvatarUrl', () => {
  it('returns null for null/undefined/empty input', () => {
    expect(toAvatarUrl(null)).toBeNull();
    expect(toAvatarUrl(undefined)).toBeNull();
    expect(toAvatarUrl('')).toBeNull();
  });

  it('rewrites inset.jpg to avatar.jpg', () => {
    expect(toAvatarUrl('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg'))
      .toBe('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-avatar.jpg');
  });

  it('rewrites main-raw.png to avatar.jpg', () => {
    expect(toAvatarUrl('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-main-raw.png'))
      .toBe('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-avatar.jpg');
  });

  it('leaves already-avatar urls unchanged', () => {
    expect(toAvatarUrl('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-avatar.jpg'))
      .toBe('https://render.worldofwarcraft.com/us/character/uldum/234/184140522-avatar.jpg');
  });

  it('preserves query strings', () => {
    expect(toAvatarUrl('https://example.com/184140522-inset.jpg?alt=v2'))
      .toBe('https://example.com/184140522-avatar.jpg?alt=v2');
  });

  it('preserves query strings on already-avatar urls', () => {
    expect(toAvatarUrl('https://example.com/abc-avatar.jpg?token=xyz'))
      .toBe('https://example.com/abc-avatar.jpg?token=xyz');
  });

  it('passes through non-variant urls unchanged', () => {
    expect(toAvatarUrl('https://example.com/some-other-image.png'))
      .toBe('https://example.com/some-other-image.png');
  });
});

describe('toMainBodyUrl (regression guard)', () => {
  it('still rewrites avatar.jpg to main-raw.png', () => {
    expect(toMainBodyUrl('https://example.com/abc-avatar.jpg'))
      .toBe('https://example.com/abc-main-raw.png');
  });
});
