import assert from 'node:assert/strict';
import test from 'node:test';
import { allowLocalSeedanceDraftPreview } from '../frontend/app/(core)/(workspace)/app/_lib/seedance-draft-local-preview-gate';

test('Draft UI preview only opens on an explicitly requested isolated localhost development page', () => {
  const local = { requested: '1', host: 'localhost:3106', environment: 'development', sandbox: '1' };
  assert.equal(allowLocalSeedanceDraftPreview(local), true);
  for (const host of ['127.0.0.1:3106', '[::1]:3106', 'localhost']) {
    assert.equal(allowLocalSeedanceDraftPreview({ ...local, host }), true);
  }
  for (const patch of [
    { environment: 'production' }, { environment: 'test' }, { environment: undefined },
    { sandbox: undefined }, { sandbox: '0' }, { requested: undefined }, { requested: 'true' },
    { host: 'maxvideoai.com' }, { host: 'localhost.example.com' }, { host: 'localhost@evil.example' },
    { host: 'evil.example/localhost' }, { host: '' }, { host: null }, { host: 'localhost:99999' },
  ]) assert.equal(allowLocalSeedanceDraftPreview({ ...local, ...patch }), false, JSON.stringify(patch));
});
