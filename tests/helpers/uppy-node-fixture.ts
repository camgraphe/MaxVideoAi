import { buildSync } from 'esbuild';
import { createRequire, Module } from 'node:module';
import { resolve } from 'node:path';
// These DOM tests execute application TS as CommonJS. Uppy's installed SDK has
// import-only transitive exports, so bundle that real SDK exactly as Next does.
// No queue, transport, duplicate identity or admission implementation is mocked.
const require = createRequire(resolve('frontend/package.json'));
const entry = require.resolve('@uppy/core');
if (!require.cache[entry]) {
  const code = buildSync({ entryPoints: [entry], bundle: true, platform: 'browser', format: 'cjs', write: false }).outputFiles[0].text;
  const compiled = new Module(entry);
  // Bind SDK timers to the current DOM just as in the browser. JSDOM.close then
  // clears its delayed online check; Node timers would outlive the removed window.
  new Function('module', 'exports', 'setTimeout', 'clearTimeout', code)(compiled, compiled.exports,
    (...args: Parameters<typeof window.setTimeout>) => window.setTimeout(...args),
    (id: number) => window.clearTimeout(id));
  compiled.loaded = true;
  require.cache[entry] = compiled;
}
