import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNormalizedGenerationAttachments } from '../frontend/app/api/generate/_lib/normalized-generation-attachment-validation';
import { resolveGenerateSourceVideoContext } from '../frontend/app/api/generate/_lib/source-video-context';
import { resolveAlibabaSubmissionMediaInputs } from '../frontend/app/api/generate/_lib/alibaba-model-studio-submission';
import { WAN_3_INPUT_SCHEMA } from '../frontend/src/config/fal-engines/wan-3-shared';

for (const mode of ['v2v', 'extend'] as const) {
  test(`Wan ${mode} uses persisted source duration for provider cost and the 30-second limit`, async () => {
    const url = 'https://media.maxvideoai.com/source.mp4';
    const processed = await validateNormalizedGenerationAttachments({
      engineId: 'wan-3', mode, userId: 'user-1', inputSchema: WAN_3_INPUT_SCHEMA,
      attachments: [{ name: 'source.mp4', type: 'video/mp4', size: 1000, kind: 'video',
        slotId: 'video_url', url, assetId: 'asset-1', durationSec: 1, width: 1, height: 1 }],
      mediaConstraintDeps: { queryFn: async <T>() => [{
        asset_id: 'asset-1', url, origin_url: null, original_name: 'source.mp4', mime_type: 'video/mp4',
        size_bytes: 1000, duration_sec: 15, width: 1280, height: 720,
      }] as T[] },
    });
    assert.equal(processed.ok, true, JSON.stringify(processed));
    if (!processed.ok) return;
    assert.equal(processed.attachments[0]?.durationSec, 15);
    assert.equal(processed.attachments[0]?.width, 1280);
    const media = resolveAlibabaSubmissionMediaInputs({ imageUrl: null, falPayload: {
      engineId: 'wan-3', mode, prompt: 'Continue this scene.', videoUrl: url,
      inputs: processed.attachments,
    } });
    assert.equal(media.inputVideoDurationSec, 15);
    for (const [outputDurationSec, allowed] of [[15, true], [16, false]] as const) {
      const result = resolveGenerateSourceVideoContext({
        mode, attachments: processed.attachments, sourceInputVideoUrl: url, videoUrls: [url],
        fallbackDurationSec: outputDurationSec, maxDurationSec: 15, engineLabel: 'Wan 3',
        maxSourcePlusOutputDurationSec: 30,
      });
      assert.equal(result.ok, allowed, `${15}s source + ${outputDurationSec}s output`);
    }
  });
}
