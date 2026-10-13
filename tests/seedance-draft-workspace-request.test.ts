import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import * as preparation from '../frontend/app/(core)/(workspace)/app/_lib/seedance-draft-request';

test('Draft request preparation shares workspace media ordering, roles, validation and creative options', () => {
  const engine = getFalEngineById('seedance-2-5')!.engine;
  const schema = engine.inputSchema!;
  const fields = [...(schema.required ?? []), ...(schema.optional ?? [])];
  const source = fields.find(field => field.id === 'video_url')!;
  const reference = fields.find(field => field.id === 'image_urls')!;
  const result = preparation.prepareSeedanceDraftWorkspaceRequest({ selectedEngineId: engine.id, selectedEngineLabel: engine.label,
    activeMode: 'v2v', submissionMode: 'v2v', prompt: 'Keep the motion', inputSchema: schema,
    inputSchemaSummary: { assetFields: [{ field: source }, { field: reference }] } as never,
    extraInputFields: fields.filter(field => ['output_format', 'return_last_frame', 'watermark'].includes(field.id)).map(field => ({ field })) as never,
    inputAssets: { video_url: [{ name: 'source.mp4', type: 'video/mp4', size: 100, kind: 'video', assetId: 'source',
      url: 'https://cdn.example/source.mp4', durationSec: 5, width: 1920, height: 1080, status: 'ready' }],
      image_urls: [{ name: 'ref.png', type: 'image/png', size: 100, kind: 'image', assetId: 'ref',
        url: 'https://cdn.example/ref.png', width: 1024, height: 1024, status: 'ready' }] } as never,
    form: { engineId: engine.id, mode: 'v2v', durationSec: 5, durationOption: 'auto', resolution: '480p', aspectRatio: 'auto', audio: false, iterations: 1, fps: 24,
      extraInputValues: { output_format: 'mov', return_last_frame: true, watermark: true } },
    primaryAssetFieldIds: new Set(['video_url']), referenceAssetFieldIds: new Set(['image_urls']), genericImageFieldIds: new Set(), frameAssetFieldIds: new Set(), referenceAudioFieldIds: new Set(['audio_urls']),
    supportsKlingV3Controls: false, klingElements: [], multiPromptActive: false, multiPromptScenes: [],
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.payload.inputs?.map(item => [item.slotId, item.assetId]), [['video_url', 'source'], ['image_urls', 'ref']]);
  assert.deepEqual(result.payload.extraInputValues, { output_format: 'mov', return_last_frame: true, watermark: true });
  assert.equal(result.payload.durationOption, 'auto');
  assert.deepEqual(result.preflightInputs, [
    { assetId: 'source', slotId: 'video_url', kind: 'video', url: 'https://cdn.example/source.mp4' },
    { assetId: 'ref', slotId: 'image_urls', kind: 'image', url: 'https://cdn.example/ref.png' },
  ]);
});
