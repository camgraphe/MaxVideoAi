import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const driver = fileURLToPath(new URL('./browser-check.mjs', import.meta.url));
test('diagnostic refuses browser work outside CI before accessing any output', () => {
  const result = spawnSync(process.execPath, [driver, 'http://127.0.0.1:3212', '/nonexistent/diagnostic'], {
    env: { ...process.env, CI: '' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /diagnostic is CI-only/);
});
test('diagnostic refuses remote targets even in CI', () => {
  const result = spawnSync(process.execPath, [driver, 'https://maxvideoai.com', '/nonexistent/diagnostic'], {
    env: { ...process.env, CI: 'true' }, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /requires the disposable loopback target/);
});
