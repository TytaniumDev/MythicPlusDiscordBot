import { useState } from 'react';
import { useCharacterSearch } from '../../hooks/useCharacterSearch';
import type { RaiderioCharacterResult } from '../../services/raiderioService';

interface CharacterSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onSelect: (result: RaiderioCharacterResult) => void;
  /** Show a loading spinner (e.g. while looking up a selected character) */
  loading?: boolean;
  placeholder?: string;
  maxLength?: number;
}

export function CharacterSearchInput({
  value,
  onChange,
  onSelect,
  loading: externalLoading = false,
  placeholder = 'PlayerName-ServerName',
  maxLength = 50,
}: CharacterSearchInputProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const { results, loading: searchLoading } = useCharacterSearch(searchQuery);

  return (
    <div className="character-search-wrapper" style={{ position: 'relative' }}>
      <input
        type="text"
        className="role-editor-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSearchQuery(e.target.value);
          setShowDropdown(true);
        }}
        onFocus={() => {
          if (results.length > 0) setShowDropdown(true);
        }}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
        maxLength={maxLength}
      />
      {showDropdown && results.length > 0 && (
        <div className="character-search-dropdown">
          {results.map((r) => (
            <button
              key={`${r.region}-${r.realmSlug}-${r.name}-${r.className}`}
              className="character-search-result"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setShowDropdown(false);
                setSearchQuery('');
                onChange(`${r.name}-${r.realm}`);
                onSelect(r);
              }}
            >
              <span className="character-search-name">{r.name}</span>
              <span className="character-search-detail">{r.realm} &middot; {r.className}</span>
            </button>
          ))}
        </div>
      )}
      {(searchLoading || externalLoading) && (
        <div className="character-search-loading" role="status" aria-live="polite" aria-label="Searching characters" />
      )}
    </div>
  );
}
