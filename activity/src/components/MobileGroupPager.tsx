import { useRef, useEffect } from 'react';
import { GroupCard } from './GroupCard';
import type { GroupCardData } from '../store/types';

interface MobileGroupPagerProps {
  groupCards: GroupCardData[];
}

export function MobileGroupPager({ groupCards }: MobileGroupPagerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (groupCards.length > prevCountRef.current && scrollRef.current) {
      const lastCard = scrollRef.current.lastElementChild as HTMLElement | null;
      lastCard?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
    prevCountRef.current = groupCards.length;
  }, [groupCards.length]);

  if (groupCards.length === 0) return null;

  return (
    <div className="mobile-group-pager">
      <div className="mobile-group-pager__scroll" ref={scrollRef}>
        {groupCards.map((card, i) => (
          <div className="mobile-group-pager__card" key={i}>
            <GroupCard
              group={card.group}
              index={card.index}
              label={card.label}
              hideEmpty={card.hideEmpty}
            />
          </div>
        ))}
      </div>
      <div className="mobile-group-pager__indicator">
        {groupCards.length} {groupCards.length === 1 ? 'group' : 'groups'}
      </div>
    </div>
  );
}
