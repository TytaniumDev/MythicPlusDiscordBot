import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { GroupCard } from './GroupCard';
import { showcaseGroups } from '../lib/showcaseFixtures';

const group = showcaseGroups[0];

describe('GroupCard variants', () => {
  afterEach(() => {
    cleanup();
  });

  it('uses .group-card class by default', () => {
    const { container } = render(<GroupCard group={group} index={0} />);
    expect(container.querySelector('.group-card')).not.toBeNull();
    expect(container.querySelector('.group-card-strip')).toBeNull();
  });

  it('uses .group-card-strip class when variant="strip"', () => {
    const { container } = render(
      <GroupCard group={group} index={0} variant="strip" />,
    );
    expect(container.querySelector('.group-card-strip')).not.toBeNull();
  });

  it('uses .group-card-compact when compact=true and variant defaulted', () => {
    const { container } = render(
      <GroupCard group={group} index={0} compact />,
    );
    expect(container.querySelector('.group-card-compact')).not.toBeNull();
  });
});
