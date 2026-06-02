import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  buildModelPlaylistHelpers,
  getPublishedExampleModelPlaylistSlugs,
} from '../frontend/server/example-family-playlists.ts';

const root = process.cwd();

test('server model playlist helpers cover published Kling O3 model playlists', () => {
  assert.deepEqual(getPublishedExampleModelPlaylistSlugs().filter((slug) => slug.startsWith('kling-o3')), [
    'kling-o3-pro',
    'kling-o3-standard',
    'kling-o3-4k',
  ]);

  const helpers = buildModelPlaylistHelpers([]);
  const bySlug = new Map(helpers.map((helper) => [helper.modelSlug, helper]));

  for (const modelSlug of ['kling-o3-pro', 'kling-o3-standard', 'kling-o3-4k']) {
    const helper = bySlug.get(modelSlug);
    assert.ok(helper, `${modelSlug} should have a server model playlist helper`);
    assert.equal(helper.slug, `examples-${modelSlug}`);
    assert.equal(helper.drivesRoute, `/models/${modelSlug}`);
    assert.equal(helper.familyId, 'kling');
    assert.equal(helper.status, 'missing');
    assert.match(helper.helperText, /examples-kling-o3-/);
  }
});

test('model playlist seeding falls back to public model jobs when examples hub has no current order', () => {
  const currentOrderSource = readFileSync(join(root, 'frontend/server/videos-current-order.ts'), 'utf8');
  assert.match(currentOrderSource, /async function listLatestPublicModelVideos/);
  assert.match(currentOrderSource, /listExampleModelCurrentPublicOrderFromSources[\s\S]+currentPublicOrder\.length/);
  assert.match(currentOrderSource, /return listLatestPublicModelVideos/);
});
