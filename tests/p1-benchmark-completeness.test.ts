import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const MODEL_IDS = [
  'gemini-omni-flash',
  'kling-3-turbo-standard',
  'kling-3-turbo-pro',
  'minimax-h3-max',
] as const;

const SCORE_FIELDS = [
  'fidelity',
  'visualQuality',
  'motion',
  'consistency',
  'anatomy',
  'textRendering',
  'lipsyncQuality',
  'sequencingQuality',
  'controllability',
  'speedStability',
  'pricing',
] as const;

const KEY_SPEC_FIELDS = [
  'textToVideo',
  'imageToVideo',
  'videoToVideo',
  'firstLastFrame',
  'referenceImageStyle',
  'referenceVideo',
  'maxResolution',
  'maxDuration',
  'aspectRatios',
  'fpsOptions',
  'outputFormats',
  'audioOutput',
  'nativeAudioGeneration',
  'lipSync',
  'cameraMotionControls',
  'watermark',
  'releaseDate',
] as const;

test('every P1 model has exactly eleven reviewed finite scores', () => {
  const document = JSON.parse(readFileSync('data/benchmarks/engine-scores.v1.json', 'utf8')) as {
    last_updated: string;
    scores: Array<Record<string, unknown> & { modelSlug: string }>;
  };

  assert.equal(document.last_updated, '2026-09-03');
  for (const modelId of MODEL_IDS) {
    const rows = document.scores.filter(({ modelSlug }) => modelSlug === modelId);
    assert.equal(rows.length, 1, `${modelId} should have one score row`);
    const row = rows[0]!;
    assert.equal(Object.hasOwn(row, 'overall'), false, `${modelId} overall stays derived`);
    for (const field of SCORE_FIELDS) {
      const value = row[field];
      assert.equal(typeof value, 'number', `${modelId}.${field}`);
      assert.ok(Number.isFinite(value as number), `${modelId}.${field}`);
      assert.ok((value as number) > 0 && (value as number) <= 10, `${modelId}.${field}`);
    }
  }
});

test('every P1 model has a complete sourced key-spec row', () => {
  const document = JSON.parse(readFileSync('data/benchmarks/engine-key-specs.v1.json', 'utf8')) as {
    last_updated: string;
    specs: Array<{ modelSlug: string; sources: string[]; keySpecs: Record<string, unknown> }>;
  };

  assert.equal(document.last_updated, '2026-09-03');
  for (const modelId of MODEL_IDS) {
    const rows = document.specs.filter(({ modelSlug }) => modelSlug === modelId);
    assert.equal(rows.length, 1, `${modelId} should have one key-spec row`);
    const row = rows[0]!;
    assert.ok(row.sources.length >= 2, `${modelId} needs at least two sources`);
    assert.ok(row.sources.every((source) => source.startsWith('https://')), `${modelId} sources`);
    for (const field of KEY_SPEC_FIELDS) {
      assert.ok(Object.hasOwn(row.keySpecs, field), `${modelId}.${field}`);
      const value = row.keySpecs[field];
      assert.notEqual(value, null, `${modelId}.${field}`);
      assert.notEqual(value, 'N/A', `${modelId}.${field}`);
    }
  }
});

test('P1 launch evidence uses eight unique reviewed video evidence ids', () => {
  const methodology = JSON.parse(readFileSync('data/benchmarks/benchmark-methodology.v1.json', 'utf8')) as {
    p1Evidence?: Array<{
      evidenceId: string;
      modelSlug: string;
      reviewStatus: string;
      observedAt: string;
    }>;
  };
  const evidence = methodology.p1Evidence ?? [];
  assert.equal(evidence.length, 8);
  assert.equal(new Set(evidence.map(({ evidenceId }) => evidenceId)).size, 8);
  for (const modelId of MODEL_IDS) {
    assert.equal(evidence.filter(({ modelSlug }) => modelSlug === modelId).length, 2, modelId);
  }
  for (const row of evidence) {
    assert.equal(row.reviewStatus, 'accepted');
    assert.ok(Number.isFinite(Date.parse(row.observedAt)), row.evidenceId);
  }
});
