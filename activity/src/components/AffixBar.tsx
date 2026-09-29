import { useId } from 'react';
import { findWeeklyAffix } from '@mythicplus/shared';
import { useAffixes } from '../hooks/useAffixes';

const BARGAIN_PREFIX = "Xal'atath's Bargain: ";

/**
 * Shows only the week's rotating affix — the others are fixed for the season,
 * so they'd just be noise on every screen. A labeled region, so screen
 * readers can find it from the landmarks list.
 */
export function AffixBar() {
  const labelId = useId();
  const data = useAffixes();
  const affix = data ? findWeeklyAffix(data.affixes) : null;

  if (!affix) return null;

  const shortName = affix.name.startsWith(BARGAIN_PREFIX)
    ? affix.name.slice(BARGAIN_PREFIX.length)
    : affix.name;

  return (
    <section className="affix-bar" aria-labelledby={labelId}>
      <span id={labelId} className="affix-bar-label">This week's affix</span>
      <div className="affix-item">
        <span
          className="affix-dot"
          style={{ background: affix.color }}
          aria-hidden="true"
        />
        <a
          href={affix.wowheadUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="affix-name"
          title={affix.name}
          aria-label={`${affix.name} (opens on Wowhead)`}
        >
          {shortName}
        </a>
        {affix.nickname && (
          <span className="affix-description">{affix.nickname}</span>
        )}
        <span className="affix-keystone">{affix.keystoneLevel}</span>
      </div>
    </section>
  );
}
