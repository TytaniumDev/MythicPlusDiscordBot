import type { Meta, StoryObj } from '@storybook/react-vite';

const meta = {
  title: 'Docs/Design Tokens',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

interface SwatchProps {
  name: string;
  value: string;
  cssVar: string;
}

function Swatch({ name, value, cssVar }: SwatchProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0' }}>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          background: value,
          border: '1px solid rgba(255,255,255,0.12)',
          flexShrink: 0,
        }}
      />
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#e5e7eb' }}>{name}</div>
        <code style={{ fontSize: 12, color: '#b0b8c4' }}>{cssVar}</code>
        <div style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>{value}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h3 style={{ color: '#fff', fontSize: 16, marginBottom: 12, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 8 }}>
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
    <div style={{ padding: 32, maxWidth: 900, fontFamily: "'Inter', sans-serif" }}>
      <h2 style={{ color: '#fff', fontSize: 24, marginBottom: 24 }}>Color Tokens</h2>

      <Section title="Brand">
        <TokenGrid>
          <Swatch name="Gold" value="#f59e0b" cssVar="--color-gold" />
          <Swatch name="Gold Dim" value="rgba(245, 158, 11, 0.6)" cssVar="--color-gold-dim" />
          <Swatch name="Purple" value="#8b5cf6" cssVar="--color-purple" />
        </TokenGrid>
      </Section>

      <Section title="Roles">
        <TokenGrid>
          <Swatch name="Tank" value="#3b82f6" cssVar="--color-tank" />
          <Swatch name="Healer" value="#22c55e" cssVar="--color-healer" />
          <Swatch name="DPS" value="#ef4444" cssVar="--color-dps" />
          <Swatch name="Brez" value="#f59e0b" cssVar="--color-brez" />
          <Swatch name="Lust" value="#e85d26" cssVar="--color-lust" />
        </TokenGrid>
      </Section>

      <Section title="Backgrounds">
        <TokenGrid>
          <Swatch name="Primary" value="#0d1117" cssVar="--bg-primary" />
          <Swatch name="Secondary" value="#161b22" cssVar="--bg-secondary" />
          <Swatch name="Card" value="rgba(255,255,255,0.04)" cssVar="--bg-card" />
          <Swatch name="Card Hover" value="rgba(255,255,255,0.08)" cssVar="--bg-card-hover" />
        </TokenGrid>
      </Section>

      <Section title="Borders">
        <TokenGrid>
          <Swatch name="Subtle" value="rgba(255,255,255,0.08)" cssVar="--border-subtle" />
          <Swatch name="Accent" value="rgba(245,158,11,0.3)" cssVar="--border-accent" />
        </TokenGrid>
      </Section>

      <Section title="Text">
        <TokenGrid>
          <Swatch name="Primary" value="#e5e7eb" cssVar="--text-primary" />
          <Swatch name="Secondary" value="#b0b8c4" cssVar="--text-secondary" />
          <Swatch name="Heading" value="#ffffff" cssVar="--text-heading" />
        </TokenGrid>
      </Section>
    </div>
  ),
};

export const Typography: Story = {
  render: () => (
    <div style={{ padding: 32, maxWidth: 700, fontFamily: "'Inter', sans-serif" }}>
      <h2 style={{ color: '#fff', fontSize: 24, marginBottom: 24 }}>Typography</h2>

      <Section title="Font Family">
        <code style={{ color: '#b0b8c4', fontSize: 14 }}>--font-family: 'Inter', sans-serif</code>
      </Section>

      <Section title="Regular (400)">
        {[12, 13, 14, 16, 20, 24].map((size) => (
          <div key={size} style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ color: '#6b7280', fontSize: 12, width: 40, fontFamily: 'monospace' }}>{size}px</span>
            <span style={{ color: '#e5e7eb', fontSize: size, fontWeight: 400 }}>
              Mythic+ Group Finder
            </span>
          </div>
        ))}
      </Section>

      <Section title="Bold (700)">
        {[14, 16, 20, 24].map((size) => (
          <div key={size} style={{ marginBottom: 12, display: 'flex', alignItems: 'baseline', gap: 16 }}>
            <span style={{ color: '#6b7280', fontSize: 12, width: 40, fontFamily: 'monospace' }}>{size}px</span>
            <span style={{ color: '#e5e7eb', fontSize: size, fontWeight: 700 }}>
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
    <div style={{ padding: 32, maxWidth: 700, fontFamily: "'Inter', sans-serif" }}>
      <h2 style={{ color: '#fff', fontSize: 24, marginBottom: 24 }}>Spacing & Radii</h2>

      <Section title="Border Radii">
        <div style={{ display: 'flex', gap: 24, alignItems: 'end' }}>
          {[
            { name: 'Small', cssVar: '--radius-sm', value: '6px' },
            { name: 'Medium', cssVar: '--radius-md', value: '10px' },
            { name: 'Large', cssVar: '--radius-lg', value: '16px' },
          ].map(({ name, cssVar, value }) => (
            <div key={name} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: value,
                  border: '2px solid #8b5cf6',
                  background: 'rgba(139, 92, 246, 0.1)',
                  marginBottom: 8,
                }}
              />
              <div style={{ fontWeight: 700, fontSize: 14, color: '#e5e7eb' }}>{name}</div>
              <code style={{ fontSize: 12, color: '#b0b8c4' }}>{cssVar}</code>
              <div style={{ fontSize: 11, color: '#6b7280' }}>{value}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Layout">
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#b0b8c4', fontSize: 12, fontWeight: 600 }}>Token</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#b0b8c4', fontSize: 12, fontWeight: 600 }}>Value</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#b0b8c4', fontSize: 12, fontWeight: 600 }}>Usage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={{ padding: '8px 12px' }}><code style={{ color: '#e5e7eb', fontSize: 13 }}>--groups-panel-width</code></td>
              <td style={{ padding: '8px 12px', color: '#b0b8c4', fontSize: 13 }}>240px (160px on medium)</td>
              <td style={{ padding: '8px 12px', color: '#6b7280', fontSize: 13 }}>Side panel for group cards</td>
            </tr>
          </tbody>
        </table>
      </Section>
    </div>
  ),
};
