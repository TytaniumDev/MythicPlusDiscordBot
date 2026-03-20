import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Docs/Design Tokens',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

interface SwatchProps {
  name: string;
  cssVar: string;
}

function Swatch({ name, cssVar }: SwatchProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: `var(${cssVar})`,
          border: '1px solid rgba(255,255,255,0.12)',
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{name}</div>
        <code style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cssVar}</code>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ color: 'var(--text-heading)', fontSize: 16, marginBottom: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function TokenGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
      {children}
    </div>
  );
}

export const Colors: Story = {
  render: () => (
    <div style={{ padding: 32, maxWidth: 900, fontFamily: 'var(--font-family)' }}>
      <h2 style={{ color: 'var(--text-heading)', fontSize: 24, marginBottom: 24 }}>Color Tokens</h2>

      <Section title="Brand">
        <TokenGrid>
          <Swatch name="Gold" cssVar="--color-gold" />
          <Swatch name="Gold Dim" cssVar="--color-gold-dim" />
          <Swatch name="Purple" cssVar="--color-purple" />
        </TokenGrid>
      </Section>

      <Section title="Roles">
        <TokenGrid>
          <Swatch name="Tank" cssVar="--color-tank" />
          <Swatch name="Healer" cssVar="--color-healer" />
          <Swatch name="DPS" cssVar="--color-dps" />
          <Swatch name="Brez" cssVar="--color-brez" />
          <Swatch name="Lust" cssVar="--color-lust" />
        </TokenGrid>
      </Section>

      <Section title="Backgrounds">
        <TokenGrid>
          <Swatch name="Primary" cssVar="--bg-primary" />
          <Swatch name="Secondary" cssVar="--bg-secondary" />
          <Swatch name="Card" cssVar="--bg-card" />
          <Swatch name="Card Hover" cssVar="--bg-card-hover" />
        </TokenGrid>
      </Section>

      <Section title="Borders">
        <TokenGrid>
          <Swatch name="Subtle" cssVar="--border-subtle" />
          <Swatch name="Accent" cssVar="--border-accent" />
        </TokenGrid>
      </Section>

      <Section title="Text">
        <TokenGrid>
          <Swatch name="Primary" cssVar="--text-primary" />
          <Swatch name="Secondary" cssVar="--text-secondary" />
          <Swatch name="Heading" cssVar="--text-heading" />
        </TokenGrid>
      </Section>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div style={{ padding: 32, maxWidth: 700, fontFamily: 'var(--font-family)' }}>
      <h2 style={{ color: 'var(--text-heading)', fontSize: 24, marginBottom: 24 }}>Typography</h2>

      <Section title="Font Family">
        <code style={{ color: 'var(--text-secondary)', fontSize: 14 }}>--font-family: 'Inter', sans-serif</code>
      </Section>

      <Section title="Regular (400)">
        {[12, 13, 14, 16, 20, 24].map((size) => (
          <div key={size} style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, width: 40, fontFamily: 'monospace' }}>{size}px</span>
            <span style={{ color: 'var(--text-primary)', fontSize: size, fontWeight: 400 }}>
              Mythic+ Group Finder
            </span>
          </div>
        ))}
      </Section>

      <Section title="Bold (700)">
        {[14, 16, 20, 24].map((size) => (
          <div key={size} style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: 12, width: 40, fontFamily: 'monospace' }}>{size}px</span>
            <span style={{ color: 'var(--text-primary)', fontSize: size, fontWeight: 700 }}>
              Mythic+ Group Finder
            </span>
          </div>
        ))}
      </Section>
    </div>
  ),
};

export const Spacing: Story = {
  render: () => (
    <div style={{ padding: 32, maxWidth: 700, fontFamily: 'var(--font-family)' }}>
      <h2 style={{ color: 'var(--text-heading)', fontSize: 24, marginBottom: 24 }}>Spacing & Radii</h2>

      <Section title="Border Radii">
        <div style={{ display: 'flex', gap: 24, alignItems: 'end' }}>
          {[
            { name: 'Small', cssVar: '--radius-sm' },
            { name: 'Medium', cssVar: '--radius-md' },
            { name: 'Large', cssVar: '--radius-lg' },
          ].map(({ name, cssVar }) => (
            <div key={name} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: `var(${cssVar})`,
                  border: '2px solid var(--color-purple)',
                  background: 'rgba(139, 92, 246, 0.1)',
                  marginBottom: 8,
                }}
              />
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{name}</div>
              <code style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cssVar}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Layout">
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Token</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Value</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600 }}>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px' }}><code style={{ color: 'var(--text-primary)', fontSize: 13 }}>--groups-panel-width</code></td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>240px (160px on medium)</td>
              <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: 13 }}>Side panel for group cards</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  ),
};
