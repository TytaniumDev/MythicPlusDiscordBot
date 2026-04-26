import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { GroupCarousel, type GroupCarouselItem } from './GroupCarousel';
import { showcaseGroups } from '../lib/showcaseFixtures';

function Harness({ initial, items }: { initial: number; items: GroupCarouselItem[] }) {
  const [i, setI] = useState(initial);
  return (
    <>
      <span data-testid="active">{i}</span>
      <GroupCarousel items={items} activeIndex={i} onActiveIndexChange={setI} />
    </>
  );
}

const items: GroupCarouselItem[] = [
  { group: showcaseGroups[0], index: 0 },
  { group: showcaseGroups[1], index: 1 },
  { group: showcaseGroups[2], index: 2, label: 'Remainder' },
];

describe('GroupCarousel navigation', () => {
  afterEach(() => {
    cleanup();
  });
  it('next arrow advances active index', async () => {
    const user = userEvent.setup();
    render(<Harness initial={0} items={items} />);
    await user.click(screen.getByLabelText('Next group'));
    expect(screen.getByTestId('active').textContent).toBe('1');
  });

  it('prev arrow is disabled at start', () => {
    render(<Harness initial={0} items={items} />);
    expect((screen.getByLabelText('Previous group') as HTMLButtonElement).disabled).toBe(true);
  });

  it('next arrow is disabled at end', () => {
    render(<Harness initial={items.length - 1} items={items} />);
    expect((screen.getByLabelText('Next group') as HTMLButtonElement).disabled).toBe(true);
  });

  it('hides arrows for a single-item carousel', () => {
    render(<Harness initial={0} items={[items[0]]} />);
    expect(screen.queryByLabelText('Previous group')).toBeNull();
    expect(screen.queryByLabelText('Next group')).toBeNull();
  });
});
