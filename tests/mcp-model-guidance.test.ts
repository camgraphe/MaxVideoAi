import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAgentModelGuidance,
  listAgentModelGuidance,
  parseAgentModelGuidance,
} from '../frontend/src/server/agent-api/model-guidance';

const knownEngineIds = new Set([
  'gemini-omni-flash',
  'minimax-h3',
  'seedance-2-5',
]);

function validEntry() {
  return {
    engineId: 'seedance-2-5',
    strengths: ['Cinematic storytelling'],
    bestFor: ['cinematic_story'],
    considerations: ['Review the model details before choosing settings.'],
    evidenceUrls: ['https://maxvideoai.com/models/seedance-2-5'],
    reviewedAt: '2026-08-24',
  };
}

test('guidance exposes exactly the reviewed engine records without pricing data', () => {
  const reviewed = listAgentModelGuidance();

  assert.deepEqual(reviewed.map((entry) => entry.engineId).sort(), [
    'gemini-omni-flash',
    'minimax-h3',
    'seedance-2-5',
  ]);
  for (const entry of reviewed) {
    assert.match(entry.reviewedAt, /^2026-08-24$/);
    assert.ok(entry.strengths.length >= 1 && entry.strengths.length <= 4);
    assert.ok(entry.bestFor.length >= 1 && entry.bestFor.length <= 5);
    assert.ok(entry.considerations.length >= 1 && entry.considerations.length <= 4);
    entry.evidenceUrls.forEach((url) => assert.match(url, /^https:\/\/maxvideoai\.com\//));
    assert.doesNotMatch(JSON.stringify(entry), /\$|€|£|priceCents|costTier|provider|0\.13/);
    assert.doesNotMatch(
      JSON.stringify(entry),
      /native_audio|high_resolution|\baudio\b|\bsound\b|\bresolution\b/i,
    );
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.strengths));
  }
  assert.equal(getAgentModelGuidance('seedance-2-5')?.bestFor.includes('product_video'), false);
  assert.equal(getAgentModelGuidance('unknown-model'), null);
});

test('guidance parser rejects invalid authored entries', () => {
  const inheritedUnknownField = Object.assign(
    Object.create({ unsupported: true }),
    validEntry(),
  );
  const mutations: Array<[string, unknown]> = [
    ['unknown engine ID', [{ ...validEntry(), engineId: 'unknown-model' }]],
    ['unknown field', [{ ...validEntry(), unsupported: true }]],
    ['inherited unknown field', [inheritedUnknownField]],
    ['invalid use case', [{ ...validEntry(), bestFor: ['unsupported_use_case'] }]],
    ['non-owned URL', [{ ...validEntry(), evidenceUrls: ['https://example.com/evidence'] }]],
    ['duplicate URL', [{ ...validEntry(), evidenceUrls: [
      'https://maxvideoai.com/models/seedance-2-5',
      'https://maxvideoai.com/models/seedance-2-5',
    ] }]],
    ['empty string', [{ ...validEntry(), strengths: [''] }]],
    ['too many strengths', [{ ...validEntry(), strengths: ['one', 'two', 'three', 'four', 'five'] }]],
    ['numeric price field', [{ ...validEntry(), priceCents: 13 }]],
  ];

  for (const [description, input] of mutations) {
    assert.throws(
      () => parseAgentModelGuidance(input, knownEngineIds),
      undefined,
      description,
    );
  }
});
