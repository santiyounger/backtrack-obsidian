import { readFile } from 'fs/promises';
import esbuild from 'esbuild';
import { builtinModules } from 'module';

const isProduction = process.argv[2] === 'production';

// Read dependencies from package.json
const { dependencies } = JSON.parse(
  await readFile(new URL('./package.json', import.meta.url))
);

// List of external dependencies to exclude from the bundle
const external = [
  ...builtinModules,
  ...Object.keys(dependencies || {}),
];

await esbuild.build({
  entryPoints: ['main.ts'],
  bundle: true,
  outfile: 'main.js',
  target: 'es2017',
  platform: 'node',
  external,
  format: 'cjs',
  sourcemap: !isProduction,
  minify: isProduction,
  watch: !isProduction && {
    onRebuild(error, result) {
      if (error) console.error('Watch build failed:', error);
      else console.log('Watch build succeeded');
    },
  },
});

if (!isProduction) {
  console.log('Watching for changes...');
}
