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
    assert.match(source, /(?:isPublishedModelPage|modelPage\.published)/, path);
  }
});
