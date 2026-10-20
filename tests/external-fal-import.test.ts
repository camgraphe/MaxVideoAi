import assert from 'node:assert/strict';
import test from 'node:test';
import { externalFalImportPlan, parseExternalFalImport } from '../frontend/server/external-fal-import/contract';
import { isExternalFalImport, applicationJobSql } from '../frontend/server/app-job-origin';

export const importFixture = () => ({
  schemaVersion: 1, ownerUserId: '11111111-1111-4111-8111-111111111111',
  engineId: 'flux-3-max', mode: 't2v', endpoint: 'blackforestlabs/flux-3-max/text-to-video',
  providerRequestId: '01a15b12-7619-7060-8be6-f69e46ed0cf1',
  providerInput: { prompt: 'A complete small film.', duration: 18, resolution: '720p', aspect_ratio: '16:9', generate_audio: true, reasoning_level: 'high' },
  videoAssetId: 'ma_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', videoSha256: 'a'.repeat(64),
  evidenceSha256: 'b'.repeat(64), references: [],
});

test('external import planning is deterministic, strictly scoped and never a charge or publication', () => {
  const input = importFixture();
  const plan = externalFalImportPlan(input);
  assert.deepEqual(plan, externalFalImportPlan(JSON.parse(JSON.stringify(input))));
  assert.match(plan.jobId, /^job_external_fal_[a-f0-9]{40}$/);
  assert.equal(plan.origin, 'external_fal_import');
  assert.equal(plan.visibility, 'private');
  assert.equal(plan.financialWrites, 0);
  assert.equal(plan.timingSamples, 0);
  assert.throws(() => parseExternalFalImport({ ...input, finalPriceCents: 0 }));
  assert.throws(() => parseExternalFalImport({ ...input, ownerUserId: '' }));
  assert.throws(() => parseExternalFalImport({ ...input, endpoint: 'other/model' }));
  assert.throws(() => parseExternalFalImport({ ...input, providerInput: { ...input.providerInput, seed: 1.5 } }));
  assert.throws(() => parseExternalFalImport({ ...input, providerInput: { ...input.providerInput, duration: 21 } }));
});

test('reference mappings must match the exact provider input order and mode', () => {
  const input = importFixture();
  const ref = { providerUrl: 'https://fal.media/a.png', assetId: 'ma_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', sha256: 'c'.repeat(64) };
  const keyframes = { ...input, mode: 'ref2v', endpoint: 'blackforestlabs/flux-3-max/keyframes-to-video',
    references: [ref], providerInput: { ...input.providerInput, keyframes: [{ image_url: ref.providerUrl, frame_index: 432 }] } };
  assert.equal(parseExternalFalImport(keyframes).mode, 'ref2v');
  assert.throws(() => parseExternalFalImport({ ...keyframes, references: [] }));
  assert.throws(() => parseExternalFalImport({ ...keyframes, references: [{ ...ref, providerUrl: 'https://fal.media/other.png' }] }));
  assert.throws(() => parseExternalFalImport({ ...keyframes, providerInput: { ...keyframes.providerInput, keyframes: [{ image_url: ref.providerUrl, frame_index: 433 }] } }));
});

test('origin predicates distinguish imported media from legacy application jobs without model-specific rules', () => {
  assert.equal(isExternalFalImport({ origin: 'external_fal_import' }), true);
  assert.equal(isExternalFalImport({ origin: 'app' }), false);
  assert.equal(isExternalFalImport(null), false);
  assert.match(applicationJobSql('j'), /external_fal_import/);
  assert.throws(() => applicationJobSql('j;DROP TABLE app_jobs'));
});
