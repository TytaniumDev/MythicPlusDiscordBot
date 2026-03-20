import { useAffixes } from '../hooks/useAffixes';

export function AffixBar() {
  const data = useAffixes();

  if (!data) return null;

  return (
    <div className="affix-bar">
      <span className="affix-bar-label">This Week's Affixes</span>
      {data.affixes.map((affix, i) => (
        <div key={affix.id} className="affix-bar-group">
          {i > 0 && <div className="affix-bar-sep" aria-hidden="true" />}
          <div className="affix-item">
            <div className="affix-item-top">
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
              >
                {affix.name}
              </a>
            </div>
            <div className="affix-item-bottom">
              <span className="affix-keystone">{affix.keystoneLevel}</span>
              {affix.nickname && (
                <span className="affix-nickname">{affix.nickname}</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
