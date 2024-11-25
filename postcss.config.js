import postcssImport from 'postcss-import';
import postcssNested from 'postcss-nested';
import path from 'path';

export default {
  plugins: [
    postcssImport({
      root: path.resolve('./styles'), // Base directory for resolving imports
    }),
    postcssNested,
  ],
};
