import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { CharacterClass } from '@mythicplus/shared';
import { Wheel, type WheelHandle, type WheelProps } from './Wheel';
import type { WheelEntry } from '../types';

function entry(
  name: string,
  characterClass: CharacterClass | null = null,
  mediaUrl: string | null = null,
  opts: Partial<WheelEntry> = {},
): WheelEntry {
  return {
    name,
    characterClass,
    mediaUrl,
    isOffspec: false,
    isChosen: false,
    ...opts,
  };
}

const TANK_POOL: WheelEntry[] = [
  entry('Gazzi', 'Druid', 'https://render.worldofwarcraft.com/us/character/uldum/0/172476416-inset.jpg'),
  entry('Thrallen', 'Paladin', 'https://render.worldofwarcraft.com/us/character/uldum/69/175929413-inset.jpg'),
  entry('Bearbutt', 'Druid', 'https://render.worldofwarcraft.com/us/character/uldum/32/173283360-inset.jpg'),
  entry('Smashface', 'Warrior', 'https://render.worldofwarcraft.com/us/character/uldum/14/173973262-inset.jpg'),
];

const HEALER_POOL: WheelEntry[] = [
  entry('Lifebloom', 'Druid'),
  entry('Holymoly', 'Priest'),
  entry('Bubblebuff', 'Paladin'),
];

const DPS_POOL: WheelEntry[] = [
  entry('Tytaniormu', 'Mage', 'https://render.worldofwarcraft.com/us/character/uldum/234/184140522-inset.jpg'),
  entry('Blueshift', 'Demon Hunter', 'https://render.worldofwarcraft.com/us/character/uldum/228/184072932-inset.jpg'),
  entry('Shadowbolt', 'Warlock'),
  entry('Pyroclast', 'Mage'),
  entry('Backstab', 'Rogue'),
  entry('Gustygale', 'Shaman'),
  entry('Frostfang', 'Death Knight'),
  entry('Arcanepew', 'Mage'),
  entry('Rainofarrows', 'Hunter'),
  entry('Windrunner', 'Hunter'),
  entry('Serpentsting', 'Hunter'),
];

const meta = {
  title: 'Wheel / Wheel',
  component: Wheel,
  decorators: [
    (Story) => (
      // Fixed pixel box. The wheel sizes itself via `.wheel-frame`'s
      // aspect-ratio + max-* constraints, so we just need to give it a
      // definite parent rectangle — Storybook's zoom will scale it visually.
      <div
        style={{
          padding: 24,
          background: '#0d0d1a',
          minHeight: '100%',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}
      >
        <div style={{ width: 280, height: 320 }}>
          <Story />
        </div>
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof Wheel>;

export default meta;

type Story = StoryObj<typeof meta>;

// Deterministic initial rotation so snapshot tests aren't flaky.
const FIXED_ROTATION = 0;

export const IdleFewEntries: Story = {
  name: 'Idle — 4 entries',
  args: {
    role: 'tank',
    label: 'Tank',
    labelClass: 'tank',
    ariaLabel: 'Tank Selection Wheel',
    initialEntries: TANK_POOL,
    initialRotation: FIXED_ROTATION,
  },
};

export const IdleMidCount: Story = {
  name: 'Idle — 3 entries',
  args: {
    role: 'healer',
    label: 'Healer',
    labelClass: 'healer',
    ariaLabel: 'Healer Selection Wheel',
    initialEntries: HEALER_POOL,
    initialRotation: FIXED_ROTATION,
  },
};

export const IdleManyEntries: Story = {
  name: 'Idle — 11 entries',
  args: {
    role: 'dps1',
    label: 'DPS',
    labelClass: 'dps',
    ariaLabel: 'DPS Selection Wheel',
    initialEntries: DPS_POOL,
    initialRotation: FIXED_ROTATION,
  },
};

export const WithChosenAndOffspec: Story = {
  name: 'Idle — with chosen + offspec slices',
  args: {
    role: 'dps2',
    label: 'DPS',
    labelClass: 'dps',
    ariaLabel: 'DPS Selection Wheel',
    initialRotation: FIXED_ROTATION,
    initialEntries: [
      entry('Tytaniormu', 'Mage', null),
      entry('Blueshift', 'Demon Hunter', null, { isOffspec: true }),
      entry('Shadowbolt', 'Warlock', null, { isChosen: true }),
      entry('Pyroclast', 'Mage', null),
      entry('Backstab', 'Rogue', null, { isOffspec: true }),
    ],
  },
};

export const LandedWithPortrait: Story = {
  name: 'Landed — winner with portrait',
  args: {
    role: 'tank',
    label: 'Tank',
    labelClass: 'tank',
    ariaLabel: 'Tank Selection Wheel',
    initialEntries: TANK_POOL,
    initialRotation: FIXED_ROTATION,
    initialWinner: 'Gazzi',
    initialRevealed: true,
  },
};

export const LandedMageWinner: Story = {
  name: 'Landed — Mage (class color border)',
  args: {
    role: 'dps1',
    label: 'DPS',
    labelClass: 'dps',
    ariaLabel: 'DPS Selection Wheel',
    initialEntries: DPS_POOL,
    initialRotation: FIXED_ROTATION,
    initialWinner: 'Tytaniormu',
    initialRevealed: true,
  },
};

export const LandedFallback: Story = {
  name: 'Landed — no image (fallback glyph)',
  args: {
    role: 'healer',
    label: 'Healer',
    labelClass: 'healer',
    ariaLabel: 'Healer Selection Wheel',
    initialEntries: HEALER_POOL,
    initialRotation: FIXED_ROTATION,
    initialWinner: 'Holymoly',
    initialRevealed: true,
  },
};

export const Empty: Story = {
  name: 'Empty — no candidates',
  args: {
    role: 'tank',
    label: 'Tank',
    labelClass: 'tank',
    ariaLabel: 'Tank Selection Wheel',
    initialEntries: [],
    initialRotation: FIXED_ROTATION,
  },
};

/**
 * Static representation of the spinning state — forces the `.spinning` class
 * via the handle's `setSpinning` method so we can visually inspect the
 * pulse-glow animation without waiting for a real spin.
 */
export const SpinningGlow: Story = {
  name: 'Spinning — pulse glow',
  render: (args) => <SpinningHarness args={args} />,
  args: {
    role: 'tank',
    label: 'Tank',
    labelClass: 'tank',
    ariaLabel: 'Tank Selection Wheel',
    initialEntries: TANK_POOL,
    initialRotation: FIXED_ROTATION,
  },
};

function SpinningHarness({ args }: { args: WheelProps }) {
  const ref = useRef<WheelHandle>(null);
  useEffect(() => {
    ref.current?.setSpinning(true);
    return () => ref.current?.setSpinning(false);
  }, []);
  return <Wheel ref={ref} {...args} />;
}

/**
 * Interactive play story — click "Spin" to trigger a real WAAPI spin.
 * Useful for manual QA of the end-to-end animation + portrait reveal.
 */
export const InteractiveSpin: Story = {
  name: 'Interactive — click to spin',
  render: (args) => <InteractiveHarness args={args} />,
  args: {
    role: 'tank',
    label: 'Tank',
    labelClass: 'tank',
    ariaLabel: 'Tank Selection Wheel',
    initialEntries: TANK_POOL,
    initialRotation: FIXED_ROTATION,
  },
};

function InteractiveHarness({ args }: { args: WheelProps }) {
  const ref = useRef<WheelHandle>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Initial entries + rotation are passed declaratively; no imperative
          init() on mount — that would reset the rotation and race with the
          first render. */}
      <Wheel ref={ref} {...args} />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        {(args.initialEntries ?? []).slice(0, 3).map((e) => (
          <button
            key={e.name}
            onClick={() => ref.current?.spinTo(e.name)}
            style={{ padding: '6px 12px', cursor: 'pointer' }}
          >
            Spin to {e.name}
          </button>
        ))}
      </div>
    </div>
  );
}
