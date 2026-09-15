import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const preload = resolve('tests/helpers/studio-node-realpath.cjs');

test('isolated Studio Node resolves linked package dependencies after inspecting a Unix socket', { skip: process.platform === 'win32' }, () => {
  // Characterizes the Node 22 filesystem assumption required by our socket-only
  // PostgreSQL fixture and pnpm links; no Next, database, SDK or HTTP mock involved.
  const script = `
    const assert = require('node:assert/strict');
    const fs = require('node:fs');
    const net = require('node:net');
    const {createRequire} = require('node:module');
    const {tmpdir} = require('node:os');
    const {join} = require('node:path');
    const root = fs.mkdtempSync(join(tmpdir(), 'studio-node-'));
    fs.mkdirSync(root + '/store/package', {recursive:true});
    fs.mkdirSync(root + '/store/node_modules/transitive', {recursive:true});
    fs.mkdirSync(root + '/node_modules');
    fs.writeFileSync(root + '/store/package/index.js', "module.exports = require('transitive');");
    fs.writeFileSync(root + '/store/node_modules/transitive/index.js', 'module.exports = 42;');
    fs.writeFileSync(root + '/prime.js', 'module.exports = 0;');
    fs.symlinkSync(root + '/store/package', root + '/node_modules/linked');
    const socket = net.createServer();
    socket.listen(root + '/socket', () => {
      try {
        const localRequire = createRequire(root + '/entry.js');
        localRequire('./prime.js');
        fs.statSync(root + '/socket');
        assert.equal(localRequire('linked'), 42);
        assert.ok(fs.realpathSync.native(root + '/node_modules/linked').endsWith('/store/package'));
      } catch (error) { console.error(error); process.exitCode = 1; }
      finally { socket.close(() => fs.rmSync(root, {recursive:true, force:true})); }
    });
  `;
  const result = spawnSync(process.execPath, [
    ...(existsSync(preload) ? ['--require', preload] : []), '-e', script,
  ], { encoding: 'utf8', timeout: 10_000, env: {
    PATH: process.env.PATH, TMPDIR: process.env.TMPDIR,
    NODE_ENV: 'development', STUDIO_INTEGRATION_RUNTIME: '1',
  } });
  assert.equal(result.status, 0, result.stderr);
});

test('Studio runtime preload refuses a normal or production process', () => {
  for (const env of [{ NODE_ENV: 'development' }, { NODE_ENV: 'production', STUDIO_INTEGRATION_RUNTIME: '1' }]) {
    const result = spawnSync(process.execPath, ['--require', preload, '-e', ''], { encoding: 'utf8', env });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /restricted to the isolated development test child/);
  }
});
