import type { StorybookConfig } from '@storybook/react-vite';
import { mergeConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  addons: [
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-mcp',
    '@storybook/addon-vitest'
  ],
  framework: '@storybook/react-vite',
  viteFinal(config) {
    return mergeConfig(config, {
      plugins: [tailwindcss()],
      define: {
        __COMMIT_HASH__: JSON.stringify('storybook'),
      },
    });
  },
};
export default config;
