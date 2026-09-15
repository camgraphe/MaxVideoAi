import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Pass a repository checkout with the existing frontend dependencies installed.
const checkout = resolve(process.argv[2] || process.cwd());
const require = createRequire(join(checkout, 'package.json'));
const { build } = require('esbuild');
await build({
  entryPoints: [fileURLToPath(new URL('./main.mjs', import.meta.url))],
  outfile: fileURLToPath(new URL('./runtime.js', import.meta.url)),
  nodePaths: [join(checkout, 'frontend/node_modules')],
  // Escaped strings preserve Three's shader contents without multiline whitespace in Git.
  supported: { 'template-literal': false },
  bundle: true, format: 'esm', minify: true, logLevel: 'info',
});
