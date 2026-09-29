import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { CharacterStage } from './CharacterStage';

const BASE = 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522';

describe('CharacterStage', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the full-body render in the class colour', () => {
    const { container } = render(<CharacterStage mediaUrl={`${BASE}-avatar.jpg`} color="#FF7C0A" alt="Gazzi" />);
    expect(screen.getByAltText('Gazzi').getAttribute('src')).toBe(`${BASE}-main-raw.png`);
    const stage = container.querySelector<HTMLElement>('.character-stage')!;
    expect(stage.style.getPropertyValue('--stage-color')).toBe('#FF7C0A');
    expect(stage.classList.contains('character-stage--neutral')).toBe(false);
  });

  it('goes grey and neutral when dimmed', () => {
    const { container } = render(<CharacterStage mediaUrl={`${BASE}-avatar.jpg`} color="#FF7C0A" dimmed alt="Gazzi" />);
    const stage = container.querySelector<HTMLElement>('.character-stage')!;
    expect(stage.classList.contains('character-stage--dimmed')).toBe(true);
    expect(stage.classList.contains('character-stage--neutral')).toBe(true);
    expect(stage.style.getPropertyValue('--stage-color')).toBe('#6b7280');
  });

  it('shows the outline and caption when there is no render', () => {
    const { container } = render(<CharacterStage mediaUrl={null} alt="Gazzi" caption="Add your in-game name" />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('.character-stage__placeholder')).not.toBeNull();
    expect(screen.getByText('Add your in-game name')).toBeTruthy();
  });

  it('falls back to the outline when the render fails to load', () => {
    const { container } = render(<CharacterStage mediaUrl={`${BASE}-avatar.jpg`} color="#FF7C0A" alt="Gazzi" />);
    fireEvent.error(screen.getByAltText('Gazzi'));
    expect(screen.queryByAltText('Gazzi')).toBeNull();
    expect(container.querySelector('.character-stage__placeholder')).not.toBeNull();
  });
});
