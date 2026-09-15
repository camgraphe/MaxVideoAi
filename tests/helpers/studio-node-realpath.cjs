'use strict';

// Test child only. Node 22's JS realpath cache can return the unresolved path
// after a socket stat, breaking pnpm's transitive dependency lookup. The native
// resolver preserves real package paths without sharing that stat/cache state.
// See studio-node-runtime.test.ts for the minimal reproduction. Remove this
// preload once the required Node runtime passes that reproduction unassisted.
if (process.env.STUDIO_INTEGRATION_RUNTIME !== '1' || process.env.NODE_ENV !== 'development') {
  throw new Error('Studio realpath preload is restricted to the isolated development test child.');
}
const fs = require('node:fs');
const nativeRealpath = fs.realpathSync.native;
function studioRealpath(path, options) {
  return nativeRealpath(path, options);
}
studioRealpath.native = nativeRealpath;
fs.realpathSync = studioRealpath;
