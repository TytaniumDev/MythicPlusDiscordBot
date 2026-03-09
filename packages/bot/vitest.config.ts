import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    conditions: ['import', 'module', 'node', 'default'],
  },
});
