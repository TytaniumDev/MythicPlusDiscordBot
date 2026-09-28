import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CharacterImage } from './CharacterImage';

const BASE = 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522';

describe('CharacterImage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the requested variant of a stored render URL', () => {
    const { rerender } = render(<CharacterImage mediaUrl={`${BASE}-inset.jpg?v=1`} variant="avatar" alt="avatar" />);
    expect(screen.getByAltText('avatar').getAttribute('src')).toBe(`${BASE}-avatar.jpg?v=1`);

    rerender(<CharacterImage mediaUrl={`${BASE}-avatar.jpg?v=1`} variant="body" alt="avatar" />);
    expect(screen.getByAltText('avatar').getAttribute('src')).toBe(`${BASE}-main-raw.png?v=1`);
  });

  it('renders the fallback when there is no URL', () => {
    render(<CharacterImage mediaUrl={null} variant="avatar" fallback={<span>T</span>} />);
    expect(screen.getByText('T')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('swaps to the fallback when the image fails, and retries a new URL', () => {
    const { rerender } = render(
      <CharacterImage mediaUrl={`${BASE}-avatar.jpg?v=1`} variant="avatar" alt="avatar" fallback={<span>T</span>} />,
    );
    fireEvent.error(screen.getByAltText('avatar'));
    expect(screen.getByText('T')).toBeTruthy();
    expect(screen.queryByAltText('avatar')).toBeNull();

    rerender(
      <CharacterImage mediaUrl={`${BASE}-avatar.jpg?v=2`} variant="avatar" alt="avatar" fallback={<span>T</span>} />,
    );
    expect(screen.getByAltText('avatar').getAttribute('src')).toBe(`${BASE}-avatar.jpg?v=2`);
  });
});
