import * as esbuild from 'esbuild';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);
const isWatchMode = process.argv.includes('--watch');

async function processCSS() {
  try {
    await execAsync('npm run postcss');
  } catch (error) {
    console.error('Error processing CSS:', error);
  }
}

const buildOptions = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'main.js',
  platform: 'node',
  target: 'es6',
  sourcemap: true,
  external: ['obsidian'],
  plugins: [
    {
      name: 'css-loader',
      setup(build) {
        build.onLoad({ filter: /\.css$/ }, async (args) => {
          return {
            contents: await fs.readFile(args.path, 'utf8'),
            loader: 'css'
          };
        });
      }
    }
  ],
};

(async () => {
  try {
    const ctx = await esbuild.context(buildOptions);

    if (isWatchMode) {
      console.log('Watching for changes...');
      await ctx.watch();
      // Run PostCSS in watch mode
      exec('npm run postcss');
    } else {
      console.log('Building...');
      await ctx.rebuild();
      await processCSS();
      await ctx.dispose();
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
})();
