import { defineConfig } from 'vite';
import { execSync } from 'child_process';

const commitHash = execSync('git rev-parse --short HEAD').toString().trim();

export default defineConfig({
  root: 'src',
  base: './', // Important for GitHub Pages relative paths
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  define: {
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
});