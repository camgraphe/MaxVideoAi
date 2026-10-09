import { createRequire } from 'node:module';
import { after } from 'node:test';

// Node's markup tests do not load stylesheets. Real CSS and its cascade are
// checked separately in the built application; keep server views synchronous.
const require = createRequire(import.meta.url);
const previous = require.extensions['.css'];
require.extensions['.css'] = () => {};
after(() => {
  if (previous) require.extensions['.css'] = previous;
  else delete require.extensions['.css'];
});
