// esbuild.config.mjs

import esbuild from 'esbuild';

const isDev = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'main.js',
  platform: 'node',
  target: 'es2020',
  format: 'cjs',
  sourcemap: isDev ? 'inline' : false,
  minify: !isDev,
  external: ['obsidian'],
  loader: {
    '.css': 'empty', // Use 'empty' to ignore CSS imports
  },
};

(async () => {
  try {
    if (isDev) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
    } else {
      await esbuild.build(buildOptions);
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
})();
