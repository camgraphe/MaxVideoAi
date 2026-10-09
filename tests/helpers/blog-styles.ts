import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

export interface StyleCompileOptions {
  legacyTypography?: boolean;
}

// Compile with the real production plugins and scan. The reference option
// restores only the previous typography owner, including the three old classes.
export async function compileBlogStyles(relativePath: string, options: StyleCompileOptions = {}) {
  const frontend = join(process.cwd(), 'frontend');
  const { stdout } = await run(process.execPath, ['-e', `
    const fs = require('node:fs');
    const path = require('node:path');
    const postcss = require('postcss');
    const config = require('./postcss.config.js');
    const options = JSON.parse(process.argv[2]);
    const file = path.resolve(process.argv[1]);
    let source = fs.readFileSync(file, 'utf8');
    if (process.argv[1] === 'app/globals.css') {
      source = source.replace(/@import "@\\/styles\\/(tokens|skeleton)\\.css";/g,
        (_, name) => fs.readFileSync(path.resolve('src/styles', name + '.css'), 'utf8'));
    }
    let legacyConfig;
    if (options.legacyTypography) {
      const base = require('tailwindcss/loadConfig')(path.resolve('tailwind.config.ts'));
      legacyConfig = { ...base, plugins: [require('@tailwindcss/typography')],
        content: [...base.content, { raw: '<div class="prose prose-slate max-w-none"></div>', extension: 'html' }] };
      source = source.replace(/@config\\s+["'][^"']+["'];\\s*/g, '');
    }
    const plugins = Object.entries(config.plugins).map(([name, settings]) =>
      require(name)(name === 'tailwindcss' && legacyConfig ? legacyConfig : settings));
    postcss(plugins).process(source, { from: file }).then(result => process.stdout.write(result.css))
      .catch(error => { console.error(error); process.exitCode = 1; });
  `, relativePath, JSON.stringify(options)], { cwd: frontend, maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}

export const blogStylesPath = 'app/(localized)/[locale]/(marketing)/blog/blog-prose.css';
export const publicProseStylesPath = 'components/marketing/public-prose.css';
