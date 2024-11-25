import fs from 'fs';
import path from 'path';
import { glob } from 'glob';
import postcss from 'postcss';
import postcssConfig from './postcss.config.js';

const outputFile = 'styles.css';

// Get all CSS files in the styles folder and its subfolders
const inputFiles = await glob('styles/**/*.css');

// Concatenate CSS files
const combinedCss = inputFiles
    .map((file) => fs.readFileSync(file, 'utf8'))
    .join('\n');

// Process with PostCSS
postcss(postcssConfig.plugins)
    .process(combinedCss, { from: undefined })
    .then((result) => {
        fs.writeFileSync(outputFile, result.css);
        console.log(`Successfully built CSS into ${outputFile}`);
    })
    .catch((err) => {
        console.error('Error during PostCSS processing:', err);
    });
