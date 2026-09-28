// Bundles the functions into dist/index.js for deploy. Firebase uploads only
// this directory to Cloud Build, which can't resolve npm workspace packages,
// so @mythicplus/shared is inlined. Runtime dependencies stay external and are
// installed by Cloud Build from package.json.
import { build } from 'esbuild';
import pkg from './package.json' with { type: 'json' };

await build({
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  external: Object.keys(pkg.dependencies),
  logLevel: 'info',
});
