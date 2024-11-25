// esbuild.config.mjs

import esbuild from 'esbuild';

const isDev = process.argv.includes('--watch');

esbuild
  .build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'main.js',
    platform: 'node',
    target: 'es2020',
    format: 'cjs',
    sourcemap: isDev ? 'inline' : false,
    minify: !isDev,
    watch: isDev,
    external: ['obsidian'],
    loader: {
      '.css': 'ignore', // Ignore CSS imports to prevent main.css and main.css.map generation
    },
  })
  .catch(() => process.exit(1));
