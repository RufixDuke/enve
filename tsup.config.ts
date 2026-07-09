import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli/cli.ts'],
  format: ['esm'],
  minify: true,
  clean: true,
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  banner: {
    js: '#!/usr/bin/env node',
  },
  target: 'node18',
  sourcemap: true,
});
