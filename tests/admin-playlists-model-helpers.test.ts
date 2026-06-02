import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildModelHelpers,
  buildHelperFallbackLabel,
} from '../frontend/components/admin/playlists/playlist-helpers.ts';
import { getFamilyFeedSourceSlugs } from '../frontend/server/playlists/slugs.ts';

const KLING_O3_MODEL_SLUGS = ['kling-o3-pro', 'kling-o3-standard', 'kling-o3-4k'] as const;

test('admin playlist helpers expose missing Kling O3 model playlists', () => {
  const helpers = buildModelHelpers([]);
  const bySlug = new Map(helpers.map((helper) => [helper.modelSlug, helper]));

  for (const modelSlug of KLING_O3_MODEL_SLUGS) {
    const helper = bySlug.get(modelSlug);
    assert.ok(helper, `${modelSlug} should have an admin model playlist helper`);
    assert.equal(helper.slug, buildHelperFallbackLabel(modelSlug));
    assert.equal(helper.route, `/models/${modelSlug}`);
    assert.equal(helper.familyId, 'kling');
    assert.equal(helper.familyRoute, '/examples/kling');
    assert.equal(helper.status, 'missing');
    assert.match(helper.label, /Kling 3\.0 Omni/);
    assert.match(helper.helperText, /Feeds \/models\/kling-o3-/);
    assert.match(helper.helperText, /\/examples\/kling/);
  }
});

test('Kling family fallback prioritizes O3 model playlists before legacy Kling V3 playlists', () => {
  assert.deepEqual(getFamilyFeedSourceSlugs('kling').slice(0, 5), [
    'family-kling',
    'examples-kling-o3-pro',
    'examples-kling-o3-standard',
    'examples-kling-o3-4k',
    'examples-kling-3-pro',
  ]);
});
