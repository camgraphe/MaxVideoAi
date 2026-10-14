import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareSeedanceWorkflowSubmission } from '../frontend/server/seedance-workflow-submission';

test('owned pending Draft submissions retain per-mode media and reject a changed workflow step', async () => {
  for (const mode of ['i2v', 'ref2v', 'v2v', 'extend'] as const) {
    const result = await prepareSeedanceWorkflowSubmission({ workflow: { step: 'draft' }, jobId: 'draft', userId: 'owner',
      engineId: 'seedance-2-5', iterationCount: 1, paymentMode: 'wallet', payloadInput: {
        modelId: 'dreamina-seedance-2-5-260628', mode, prompt: 'Continue the motion', durationSec: 5, resolution: '480p', transport: 'modelark',
        imageUrl: mode === 'i2v' ? 'https://cdn.example/image.png' : undefined,
        referenceImageUrls: mode === 'ref2v' ? ['https://cdn.example/ref.png'] : undefined,
        referenceVideoUrls: mode === 'v2v' || mode === 'extend' ? ['https://cdn.example/source.mp4'] : undefined,
      } }, async sql => sql.includes('SELECT settings_snapshot') ? [{ settings_snapshot: { inputMode: mode, seedanceWorkflow: { step: 'draft' } } }] : []);
    assert.equal(result.payload.draft, true);
    assert.ok(result.payload.content.some(item => item.type === (mode === 'i2v' || mode === 'ref2v' ? 'image_url' : 'video_url')));
  }
});

test('Final output choices come from stored owned settings and content contains only the reserved Draft', async () => {
  const result = await prepareSeedanceWorkflowSubmission({ workflow: { step: 'final', draftJobId: 'draft' }, jobId: 'final', userId: 'owner',
    engineId: 'seedance-2-5', iterationCount: 1, paymentMode: 'wallet', payloadInput: {
      modelId: 'forged-model', mode: 'v2v', prompt: 'forged', durationSec: 5, resolution: '1080p',
      referenceVideoUrls: ['https://evil.example/source.mp4'], watermark: false,
    } }, async sql => sql.includes('SELECT settings_snapshot') ? [{ settings_snapshot: { inputMode: 'v2v',
      seedanceWorkflow: { step: 'final', draftJobId: 'draft' }, advanced: { extraInputValues: {
        output_format: 'mov', return_last_frame: true, watermark: true } } } }]
      : [{ provider_task_id: 'owned-task', provider_model_id: 'owned-model' }]);
  assert.deepEqual(result.payload, { model: 'owned-model', content: [{ type: 'draft_task', draft_task: { id: 'owned-task' } }],
    resolution: '1080p', watermark: true, output_format: 'mov', return_last_frame: true });
});
