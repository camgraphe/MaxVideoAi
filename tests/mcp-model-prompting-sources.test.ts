import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAgentModelPromptingSources,
  listAgentModelPromptingSourceRecords,
  parseAgentModelPromptingSources,
} from '../frontend/src/server/agent-api/model-prompting-sources';

const knownEngineIds = new Set([
  'gemini-omni-flash',
  'gpt-image-2',
  'minimax-h3',
  'seedance-2-0',
  'seedance-2-5',
  'veo-3-1',
]);

function validRecord() {
  return {
    id: 'google-veo-3-1-prompting',
    provider: 'Google',
    title: 'Ultimate prompting guide for Veo 3.1',
    url: 'https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1',
    modelIds: ['veo-3-1'],
    modes: ['t2v', 'i2v'],
    reviewedAt: '2026-08-28',
  };
}

test('official prompting sources are reviewed, model-scoped, immutable, and free of pricing claims', () => {
  const records = listAgentModelPromptingSourceRecords();
  const sourcesByModel = new Map<string, number>();

  assert.ok(records.length >= 9);
  for (const record of records) {
    assert.match(record.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.match(record.url, /^https:\/\//);
    assert.match(record.reviewedAt, /^2026-(08-28|09-01)$/);
    assert.ok(record.modelIds.length >= 1);
    assert.ok(record.modes.length >= 1);
    assert.ok(Object.isFrozen(record));
    assert.ok(Object.isFrozen(record.modelIds));
    assert.ok(Object.isFrozen(record.modes));
    assert.doesNotMatch(JSON.stringify(record), /\$|€|£|price|cost|credit/i);
    for (const modelId of record.modelIds) {
      sourcesByModel.set(modelId, (sourcesByModel.get(modelId) ?? 0) + 1);
    }
  }

  assert.ok(records.some((record) => record.modelIds.includes('gemini-omni-flash')));
  assert.ok(records.some((record) => record.modelIds.includes('gpt-image-2')));
  assert.ok(records.some((record) => record.modelIds.includes('minimax-h3')));
  assert.ok(records.some((record) => record.modelIds.includes('seedance-2-0')));
  assert.ok(records.some((record) => record.modelIds.includes('seedance-2-5')));
  assert.ok(records.some((record) => record.modelIds.includes('veo-3-1')));
  assert.ok(records.some((record) => record.modelIds.includes('wan-3') && new URL(record.url).hostname === 'docs.modelstudio.console.alibabacloud.com'));
  assert.ok(records.some((record) => record.modelIds.includes('grok-imagine-video-1-5') && new URL(record.url).hostname === 'docs.x.ai'));
  assert.ok(records.some((record) => record.modelIds.includes('flux-3') && new URL(record.url).hostname === 'bfl.ai'));
  assert.equal(records.some((record) => new URL(record.url).hostname.endsWith('fal.ai')), false);
  assert.ok([...sourcesByModel.values()].every((count) => count <= 3));

  const veo = getAgentModelPromptingSources('veo-3-1');
  assert.deepEqual(veo.map((source) => source.provider), ['Google']);
  assert.equal('modelIds' in veo[0], false);
  assert.equal(Object.isFrozen(veo), true);
  assert.equal(Object.isFrozen(veo[0]), true);
  assert.deepEqual(getAgentModelPromptingSources('unknown-model'), []);
});

test('prompting-source parser fails closed for unknown fields, models, modes, and domains', () => {
  const inheritedUnknownField = Object.assign(
    Object.create({ unsupported: true }),
    validRecord(),
  );
  const mutations: Array<[string, unknown]> = [
    ['unknown field', [{ ...validRecord(), unsupported: true }]],
    ['inherited unknown field', [inheritedUnknownField]],
    ['unknown model', [{ ...validRecord(), modelIds: ['unknown-model'] }]],
    ['unknown mode', [{ ...validRecord(), modes: ['storyboard'] }]],
    ['unreviewed domain', [{ ...validRecord(), url: 'https://example.com/prompting' }]],
    ['Fal distributor domain', [{ ...validRecord(), url: 'https://fal.ai/models/veo' }]],
    ['insecure URL', [{ ...validRecord(), url: 'http://cloud.google.com/prompting' }]],
    ['duplicate source ID', [validRecord(), validRecord()]],
    ['duplicate model', [{ ...validRecord(), modelIds: ['veo-3-1', 'veo-3-1'] }]],
    ['invalid date', [{ ...validRecord(), reviewedAt: '2026-02-30' }]],
  ];

  for (const [description, input] of mutations) {
    assert.throws(
      () => parseAgentModelPromptingSources(input, knownEngineIds),
      undefined,
      description,
    );
  }

  assert.throws(() => parseAgentModelPromptingSources(
    [{ ...validRecord(), modes: ['ref2v'] }],
    knownEngineIds,
    new Map([['veo-3-1', new Set(['t2v', 'i2v'])]]),
  ));
});
