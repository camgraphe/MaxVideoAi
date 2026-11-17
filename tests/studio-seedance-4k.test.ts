import assert from 'node:assert/strict';
import test from 'node:test';
import { ENV } from '../frontend/src/lib/env';
import { studioMediaRequest, type StudioMediaFactories } from '../frontend/src/server/studio/conversation-media-generation';
import { createStudioVideoGenerationService } from '../frontend/src/server/studio/image-generation-service';
import { studioVisualCapabilityDetails } from '../frontend/src/server/studio/conversation-capabilities';
import { actionFromTool } from '../frontend/lib/studio/conversation-action-contract';
import { buildPaidVideoRequestBody } from '../frontend/src/server/agent-api/paid-video-request-body';
import type { CanonicalGenerationRequest } from '../frontend/src/server/agent-api/generation-types';
import { toolAssetRefSchema } from '../frontend/src/lib/toolbox/contract';
import { workflowActor, workflowInput, workflowCatalog, workflowAction, workflowReference, workflowResolved } from './helpers/studio-video-workflow-fixtures';

test('Milo discovers and prepares 4K through the certified Studio modes and canonical paid request', async () => {
  const prior = ENV.SEEDANCE_2_5_EDIT_TRANSPORT;
  ENV.SEEDANCE_2_5_EDIT_TRANSPORT = 'modelark';
  try {
    const catalog = (await workflowCatalog()).filter(candidate => candidate.engine.id === 'seedance-2-5');
    const studio = createStudioVideoGenerationService(workflowActor, { enabled: true,
      prepareDependencies: { listPublicEngines: async () => catalog } });
    const [candidate] = await studio.catalog();
    const details = studioVisualCapabilityDetails(candidate);
    assert.ok(details.surface !== 'audio');
    assert.deepEqual(candidate.publicModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'extend']);
    const factories = { video: () => studio } as unknown as StudioMediaFactories;
    for (const mode of candidate.publicModes) {
      assert.ok(details.modes.find(detail => detail.mode === mode)?.resolutions.includes('4k'), mode);
      const selected = workflowAction(candidate, mode);
      selected.settings = selected.settings!.map(setting => setting.name === 'resolution' ? { ...setting, value: '4k' } : setting);
      const { action: _action, ...args } = selected;
      const action = actionFromTool('video_prepare', args);
      assert.equal(action.action, 'video.prepare');
      if (action.action !== 'video.prepare') throw new Error('Expected a video action');
      const request = await studioMediaRequest(workflowActor, action, workflowInput, factories, true, {
        resolveMedia: async (_user, raw) => {
          const ref = toolAssetRefSchema.parse(raw), media = workflowReference(ref.kind, 'source');
          return { kind: media.mediaKind, url: media.storageUrl, mime: media.mimeType, width: media.width, height: media.height,
            durationSec: media.durationSec, sizeBytes: media.sizeBytes, originalName: media.originalName } as never;
        },
      }) as CanonicalGenerationRequest;
      assert.equal(request.settings.resolution, '4k', mode);
      const body = buildPaidVideoRequestBody({ quoteId: workflowInput.requestId, request, engine: candidate.engine,
        resolvedReferences: workflowResolved(request, action), canonicalPricing: { membershipTier: 'member' } });
      assert.equal(body.resolution, '4k', mode);
      assert.equal(body.engineId, 'seedance-2-5');
    }
  } finally { ENV.SEEDANCE_2_5_EDIT_TRANSPORT = prior; }
});
