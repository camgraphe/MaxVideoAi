import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import type { FalEngineEntry } from '../frontend/src/config/falEngines.ts';
import {
  isRuntimeModelPagePublished,
  listRuntimeModels,
  toLegacyModelSurfaces,
} from '../frontend/config/model-runtime.ts';
import { isPublishedModelPage } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-publication.ts';

const P0_MODEL_IDS = [
  'wan-3',
  'wan-3-prime',
  'ltx-2-5-fast',
  'ltx-2-5-pro',
  'grok-imagine-video-1-5',
  'flux-3',
  'flux-3-draft',
] as const;

function engine(id: string, publication: { indexable: boolean; includeInSitemap: boolean }) {
  return {
    id,
    surfaces: { modelPage: publication },
  } as Pick<FalEngineEntry, 'id' | 'surfaces'>;
}

test('published noindex model pages render even when excluded from the sitemap', () => {
  assert.equal(
    isPublishedModelPage(engine('gemini-omni-flash', { indexable: false, includeInSitemap: false })),
    true
  );
});

test('runtime projection exposes model publication independently from indexation and sitemap policy', () => {
  const model = structuredClone(listRuntimeModels()[0]);
  model.publication.model.published = true;
  model.publication.model.indexable = false;
  model.publication.sitemap.published = false;
  assert.deepEqual(toLegacyModelSurfaces(model).modelPage, {
    indexable: false,
    includeInSitemap: false,
  });
  assert.equal(isRuntimeModelPagePublished(model), true);
  model.publication.model.published = false;
  assert.equal(isRuntimeModelPagePublished(model), false);
});

test('hidden model pages return the unpublished route decision', () => {
  assert.equal(
    isPublishedModelPage(engine('seedance-2-0-fast-byteplus', { indexable: false, includeInSitemap: false })),
    false
  );
  assert.equal(isPublishedModelPage(null), false);
});

test('model route gates use published state rather than sitemap membership', () => {
  for (const path of [
    'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/page.tsx',
    'frontend/app/models/[slug]/page.tsx',
  ]) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /includeInSitemap/, path);
    assert.match(
      source,
      /(?:isPublishedModelPage|modelPage\.published|listPublishedRuntimeModels)/,
      path,
    );
  }
});

test('all seven P0 model routes are published, indexable and sitemap-eligible', () => {
  const runtimeById = new Map(listRuntimeModels().map((model) => [model.id, model]));
  for (const id of P0_MODEL_IDS) {
    const model = runtimeById.get(id);
    assert.ok(model, id);
    assert.equal(isRuntimeModelPagePublished(model), true, id);
    assert.deepEqual(model.publication.model, { published: true, indexable: true }, id);
    assert.equal(model.publication.sitemap.published, true, id);
  }
});
