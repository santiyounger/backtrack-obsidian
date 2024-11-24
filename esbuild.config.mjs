import * as esbuild from 'esbuild';

const isWatchMode = process.argv.includes('--watch');

(async () => {
  const buildContext = await esbuild.context({
    entryPoints: ['src/main.ts'],
    bundle: true,
    outfile: 'main.js',
    platform: 'node',
    target: 'es6',
    sourcemap: true,
    external: ['obsidian'], // Mark Obsidian module as external
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
