import type { Preview } from '@storybook/react-vite';
import '../src/index.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      values: [
        { name: 'App', value: '#0d1117' },
        { name: 'Card', value: '#161b22' },
      ],
      default: 'App',
    },

    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    layout: 'centered',

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo'
    },

    viewport: {
      viewports: {
        discordSmall: {
          name: 'Discord Activity (Small)',
          styles: { width: '480px', height: '720px' },
        },
        discordMedium: {
          name: 'Discord Activity (Medium)',
          styles: { width: '680px', height: '800px' },
        },
        discordLarge: {
          name: 'Discord Activity (Large)',
          styles: { width: '905px', height: '900px' },
        },
        mobile: {
          name: 'Mobile',
          styles: { width: '375px', height: '667px' },
        },
        tablet: {
          name: 'Tablet',
          styles: { width: '768px', height: '1024px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1280px', height: '900px' },
        },
      },
    },

    options: {
      storySort: {
        order: ['Docs', 'Atoms', 'Molecules', 'Organisms', 'Pages'],
      },
    },
  },

  tags: ['autodocs'],
};

export default preview;
