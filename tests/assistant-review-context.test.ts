import assert from 'node:assert/strict';
import test from 'node:test';

test('review captures actual runtime and context while excluding credentials, pixels and hidden reasoning', async () => {
  const api = await import('../frontend/src/server/assistant-review/context').catch(() => null);
  assert.ok(api?.buildAssistantReviewContext, 'A shared input manifest is required');
  const params = { model: 'gpt-6.1-terra', instructions: 'Use the selected model.', reasoning: { effort: 'high' }, max_output_tokens: 6000,
    tools: [{ type: 'function', name: 'model_details', parameters: { type: 'object' } }],
    input: [{ role: 'user', content: [{ type: 'input_text', text: 'Slow pan, 8 seconds. https://private.test/asset?signature=SECRET' }, { type: 'input_image', image_url: 'data:image/png;base64,NEVER_PIXELS', detail: 'auto' }] },
      { type: 'reasoning', encrypted_content: 'NEVER_REASONING', summary: [{ text: 'NEVER_SUMMARY' }] },
      { type: 'function_call', name: 'video_prepare', arguments: JSON.stringify({ prompt: 'A blue boat', settings: { durationSec: 8, audio: false }, Authorization: 'NEVER_AUTH' }) }],
  };
  const manifest = api.buildAssistantReviewContext(params);
  assert.equal(manifest.model, 'gpt-6.1-terra');
  assert.equal(manifest.reasoning, 'high');
  assert.equal(manifest.maxOutputTokens, 6000);
  assert.equal(manifest.media.images, 1);
  assert.equal(api.projectReviewData(new Date('2026-10-29T12:00:00Z')).value,'2026-10-29T12:00:00.000Z');
  assert.match(JSON.stringify(manifest.toolSchema),/model_details/);
  assert.equal((api.projectReviewData({instructionsHash:manifest.instructionsHash}).value as any).instructionsHash,manifest.instructionsHash);
  assert.match(JSON.stringify(manifest.input), /Slow pan|A blue boat|durationSec/);
  assert.doesNotMatch(JSON.stringify(manifest), /NEVER_|private\.test|signature=|data:image/);
  assert.notEqual(manifest.instructionsHash, api.buildAssistantReviewContext({ ...params, instructions: 'Changed.' }).instructionsHash);
  assert.notEqual(manifest.toolsHash, api.buildAssistantReviewContext({ ...params, tools: [] }).toolsHash);
});

test('review projections bound oversized hostile stored context and report truncation', async () => {
  const api = await import('../frontend/src/server/assistant-review/context').catch(() => null);
  assert.ok(api?.projectReviewData, 'Bounded historical context projection is required');
  const projected = api.projectReviewData({ settings: { durationSec: 30, audio: false }, references: [{ label: 'Video 1', url: 'https://private.test', token: '@Video1' }], giant: '猫'.repeat(400000), password: 'NEVER_PASSWORD' });
  assert.equal(projected.truncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(projected)) < 270000);
  assert.doesNotMatch(JSON.stringify(projected), /private\.test|NEVER_PASSWORD/);
  assert.match(JSON.stringify(projected), /Video 1|@Video1/);
});
