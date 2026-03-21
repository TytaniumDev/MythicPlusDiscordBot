import { useState } from 'react';
import type { Meta } from '@storybook/react-vite';
import { CharacterSearchInput } from './CharacterSearchInput';
import type { RaiderioCharacterResult } from '../../services/raiderioService';

const MOCK_RESULTS: RaiderioCharacterResult[] = [
  { name: 'Tytanium', realm: "Kael'thas", realmSlug: 'kaelthas', region: 'us', className: 'Druid' },
  { name: 'Tytanium', realm: "Kael'thas", realmSlug: 'kaelthas', region: 'us', className: 'Warrior' },
  { name: 'Tytanium', realm: 'Malygos', realmSlug: 'malygos', region: 'us', className: 'Paladin' },
  { name: 'Tytanium', realm: 'Proudmoore', realmSlug: 'proudmoore', region: 'us', className: 'Mage' },
  { name: 'Tytanium', realm: 'Area 52', realmSlug: 'area-52', region: 'us', className: 'Death Knight' },
];

/**
 * Wrapper that simulates the dropdown with static mock results,
 * bypassing the real Raider.io search hook.
 */
function MockDropdown({
  initialValue = '',
  loading = false,
}: {
  initialValue?: string;
  loading?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  const [selected, setSelected] = useState<RaiderioCharacterResult | null>(null);

  return (
    <div style={{ maxWidth: 320, position: 'relative' }}>
      <div className="role-editor-label" style={{ marginBottom: 4 }}>In-Game Name</div>
      {/* Render a static mock dropdown since the real component relies on useCharacterSearch */}
      <div className="character-search-wrapper" style={{ position: 'relative' }}>
        <input
          type="text"
          className="role-editor-input"
          placeholder="PlayerName-ServerName"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={50}
        />
        {!selected && value.length >= 3 && (
          <div className="character-search-dropdown">
            {MOCK_RESULTS.map((r) => (
              <button
                key={`${r.region}-${r.realmSlug}-${r.name}-${r.className}`}
                className="character-search-result"
                onClick={() => {
                  setValue(`${r.name}-${r.realm}`);
                  setSelected(r);
                }}
              >
                <span className="character-search-name">{r.name}</span>
                <span className="character-search-detail">{r.realm} &middot; {r.className}</span>
              </button>
            ))}
          </div>
        )}
        {loading && (
          <div className="character-search-loading" role="status" aria-live="polite" aria-label="Searching characters" />
        )}
      </div>
      {selected && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          Selected: {selected.name} - {selected.realm} ({selected.className})
        </div>
      )}
    </div>
  );
}

const meta = {
  title: 'Atoms/CharacterSearchInput',
  component: CharacterSearchInput,
  parameters: {
    docs: {
      description: {
        component: 'Autocomplete input for searching WoW character names via Raider.io. Displays a dropdown of matching characters with realm and class info.',
      },
    },
  },
} satisfies Meta<typeof CharacterSearchInput>;

export default meta;

const noop = () => {};

/** Dropdown open with mock search results */
export const WithResults = {
  render: () => <MockDropdown initialValue="Tytanium" />,
  args: { value: '', onChange: noop, onSelect: noop },
};

/** Empty state before typing */
export const Empty = {
  render: () => <MockDropdown />,
  args: { value: '', onChange: noop, onSelect: noop },
};

/** Shows loading spinner */
export const Loading = {
  render: () => <MockDropdown initialValue="Tyt" loading />,
  args: { value: '', onChange: noop, onSelect: noop },
};
