import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  base: './', // Important for GitHub Pages relative paths
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  }
});