import assert from 'node:assert/strict';
import test from 'node:test';
import { listFalEngines } from '../frontend/src/config/falEngines';
import { getWorkspaceVideoDurationGuidance, getWorkspaceVideoDurationRejection } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-video-duration-guidance';
import type { ReferenceAsset } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-assets';

function source(durationSec: number | null): ReferenceAsset {
  return { id: 'source', fieldId: 'video_url', kind: 'video', name: 'clip.mp4', size: 1000, type: 'video/mp4', status: 'ready',
    url: 'https://example.com/clip.mp4', previewUrl: 'https://example.com/clip.mp4', durationSec };
}
function engine(id: string) { return listFalEngines().find(entry => entry.id === id)!.engine; }

test('source limits never inherit the model output-duration maximum', () => {
  assert.equal(getWorkspaceVideoDurationGuidance({ engine: engine('lumaRay2'), mode: 'v2v', locale: 'en',
    outputDurationSec: 5, inputAssets: { video_url: [source(45)] } }), undefined);
});

test('Extend respects exclusive source limits and explains that the clip must be shorter', () => {
  const options = { engine: engine('flux-3'), mode: 'extend' as const, locale: 'en', outputDurationSec: 5 };
  assert.match(getWorkspaceVideoDurationGuidance({ ...options, inputAssets: { video_url: [source(15)] } }) ?? '', /less than 15/);
  assert.equal(getWorkspaceVideoDurationGuidance({ ...options, inputAssets: { video_url: [source(14.99)] } }), undefined);
});

test('field limits and source plus output limits retain their distinct repair instructions', () => {
  const options = { engine: engine('wan-3'), mode: 'extend' as const, locale: 'en' };
  assert.equal(getWorkspaceVideoDurationGuidance({ ...options, inputAssets: { video_url: [source(15)] }, outputDurationSec: 15 }), undefined);
  assert.match(getWorkspaceVideoDurationGuidance({ ...options, inputAssets: { video_url: [source(15.1)] }, outputDurationSec: 5 }) ?? '', /15\.1/);
  const message = getWorkspaceVideoDurationGuidance({ ...options, inputAssets: { video_url: [source(15)] }, outputDurationSec: 16 });
  assert.match(message ?? '', /31/); assert.match(message ?? '', /30/); assert.match(message ?? '', /reduce the generated duration/);
});

test('unknown duration and inputs outside the active mode do not invent duration errors', () => {
  const options = { engine: engine('seedance-2-0'), locale: 'en', outputDurationSec: 5 };
  assert.equal(getWorkspaceVideoDurationGuidance({ ...options, mode: 'v2v', inputAssets: { video_url: [source(null)] } }), undefined);
  assert.equal(getWorkspaceVideoDurationGuidance({ ...options, mode: 't2v', inputAssets: { video_url: [source(20)] } }), undefined);
  assert.equal(getWorkspaceVideoDurationGuidance({ ...options, mode: 'extend', inputAssets: { video_url: [source(20)] } }), undefined);
});

test('too-short clips and audio duration errors never tell the user to shorten a video', () => {
  const error = { code: 'MEDIA_DURATION_UNSUPPORTED', field: 'video_url', durationSec: 2, maxDurationSec: 10 };
  assert.equal(getWorkspaceVideoDurationRejection(error, 'en'), undefined);
  assert.equal(getWorkspaceVideoDurationRejection({ ...error, field: 'audio_url', durationSec: 20 }, 'en'), undefined);
  assert.equal(getWorkspaceVideoDurationRejection({ ...error, durationSec: NaN }, 'en'), undefined);
});
