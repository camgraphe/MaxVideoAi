import assert from 'node:assert/strict';
import test from 'node:test';
import { authorizeEditorialIngest, ingestEditorialDraft } from '../frontend/src/server/editorial/ingest.ts';
import { makeEditorialDraft } from './fixtures/editorial-draft.ts';

function uploadedDraft() {
  const draft = makeEditorialDraft();
  return { ...draft, assets: draft.assets.map((asset) => ({ ...asset, sha256: 'a'.repeat(64), storageKey: `editorial/drafts/${'a'.repeat(64)}.webp` })) };
}

test('ingest token is mandatory and exact', () => {
  assert.equal(authorizeEditorialIngest('Bearer example-secret', 'example-secret'), true);
  assert.equal(authorizeEditorialIngest('Bearer wrong', 'example-secret'), false);
  assert.equal(authorizeEditorialIngest('', ''), false);
});

test('ingestion checks every media object before saving', async () => {
  const seen: string[] = [];
  let saved = false;
  const result = await ingestEditorialDraft(uploadedDraft(), 'workflow', {
    isPublishedSlug: async () => false,
    getAssetMetadata: async (key) => {
      seen.push(key);
      return { size: 120000, mime: 'image/webp' };
    },
    save: async () => {
      saved = true;
      return { articleId: 'article-1', version: 1, digest: 'a'.repeat(64) };
    },
  });
  assert.deepEqual(seen, [`editorial/drafts/${'a'.repeat(64)}.webp`]);
  assert.equal(saved, true);
  assert.equal(result.version, 1);
});

test('ingestion rejects a missing hash or a key inconsistent with the uploader before storage lookup', async () => {
  const dependencies = {
    isPublishedSlug: async () => false,
    getAssetMetadata: async () => { throw Error('Storage must not be reached'); },
    save: async () => { throw Error('Invalid manifests must not be saved'); },
  };
  await assert.rejects(ingestEditorialDraft(makeEditorialDraft(), 'workflow', dependencies), /hash-derived media key/i);
  const mismatched = uploadedDraft();
  mismatched.assets[0].storageKey = `editorial/drafts/${'b'.repeat(64)}.webp`;
  await assert.rejects(ingestEditorialDraft(mismatched, 'workflow', dependencies), /hash-derived media key/i);
  mismatched.assets[0].storageKey = `editorial/drafts/${'a'.repeat(64)}.png`;
  await assert.rejects(ingestEditorialDraft(mismatched, 'workflow', dependencies), /hash-derived media key/i);
});

test('ingestion fails closed for an absent media object or existing public slug', async () => {
  let saved = false;
  const deps = {
    isPublishedSlug: async () => false,
    getAssetMetadata: async () => ({ size: null, mime: null }),
    save: async () => { saved = true; return { articleId: 'x', version: 1, digest: 'b'.repeat(64) }; },
  };
  await assert.rejects(ingestEditorialDraft(uploadedDraft(), 'workflow', deps), /media object/i);
  assert.equal(saved, false);
  await assert.rejects(ingestEditorialDraft(makeEditorialDraft(), 'workflow', { ...deps, isPublishedSlug: async () => true }), /published slug/i);
  assert.equal(saved, false);
});
