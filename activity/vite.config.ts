import { defineConfig } from 'vite';
import { execSync } from 'child_process';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const commitHash = process.env.PLAYWRIGHT_TEST
  ? 'abc1234'
  : execSync('git rev-parse --short HEAD').toString().trim();

export default defineConfig({
  root: 'src',
  base: './', // Important for GitHub Pages relative paths
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [react(), tailwindcss()],
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
});
