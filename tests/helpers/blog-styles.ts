import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

// Use the production PostCSS plugins and Tailwind content scan from their real
// working directory. A different test config could hide duplicate utilities.
export async function compileBlogStyles(relativePath: string) {
  const frontend = join(process.cwd(), 'frontend');
  const { stdout } = await run(process.execPath, ['-e', `
    const fs = require('node:fs');
    const path = require('node:path');
    const postcss = require('postcss');
    const config = require('./postcss.config.js');
    const file = path.resolve(process.argv[1]);
    let source = fs.readFileSync(file, 'utf8');
    if (process.argv[1] === 'app/globals.css') {
      source = source.replace(/@import "@\\/styles\\/(tokens|skeleton)\\.css";/g,
        (_, name) => fs.readFileSync(path.resolve('src/styles', name + '.css'), 'utf8'));
    }
    const plugins = Object.entries(config.plugins).map(([name, options]) => require(name)(options));
    postcss(plugins).process(source, { from: file }).then(result => process.stdout.write(result.css))
      .catch(error => { console.error(error); process.exitCode = 1; });
  `, relativePath], { cwd: frontend, maxBuffer: 4 * 1024 * 1024 });
  return stdout;
}

export const blogStylesPath = 'app/(localized)/[locale]/(marketing)/blog/blog-prose.css';
