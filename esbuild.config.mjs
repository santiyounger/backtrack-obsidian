import * as esbuild from 'esbuild';

const isWatchMode = process.argv.includes('--watch');

(async () => {
  const buildContext = await esbuild.context({
    entryPoints: ['main.ts'],
    bundle: true,
    outfile: 'main.js',
    platform: 'node',
    format: 'cjs',
    target: 'es6',
    sourcemap: true,
    external: ['obsidian'],
  });

  if (isWatchMode) {
    console.log('Watching for changes...');
    await buildContext.watch();
  } else {
    console.log('Building...');
    await buildContext.rebuild();
    await buildContext.dispose();
  }
})();
