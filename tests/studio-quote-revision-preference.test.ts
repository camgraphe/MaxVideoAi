import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentApiError } from '../frontend/src/server/agent-api/errors';
import {
  prepareStudioQuoteRevision,
  studioQuoteRevision,
  studioRevisionAlternatives,
} from '../frontend/src/server/studio/conversation-quote-revision';
import { normalizeGenerationRequest } from '../frontend/src/server/agent-api/generation-normalization';

test('Studio offers only the first compatible portrait edit model and leaves product ads on the existing model', async () => {
  const source = {
    assetId: 'ma_' + 'b'.repeat(32),
    label: 'Video 1',
    kind: 'video' as const,
    requestId: 'original',
  };
  const ref = { type: 'asset' as const, kind: source.kind, assetId: source.assetId };
  const media = {
    action: 'video.prepare' as const,
    reply: 'Review the quote.',
    modelId: 'seedance-2-5',
    mode: 'v2v' as const,
    source: ref,
    aspectRatio: null,
    prompt: 'Preserve my face and replace the coat.',
  };
  const draft = { reply: media.reply, image: null, media };
  const request = normalizeGenerationRequest({
    schemaVersion: 1,
    surface: 'video',
    engineId: media.modelId,
    mode: media.mode,
    prompt: media.prompt,
    settings: { resolution: '480p', durationSec: 8, audio: true },
    references: [{ kind: 'asset', assetId: source.assetId, role: 'source' }],
    outputCount: 1,
  });
  const offered = studioRevisionAlternatives(request, draft, [source], 'fr', '');
  assert.deepEqual(
    offered.map((item) => item.label),
    ['Wan 3 Prime', 'Wan 3', 'Luma Ray 3.2', 'Seedance 2.5'],
  );
  for (const model of ['Wan 3 Prime', 'Wan 3', 'Luma Ray 3.2']) {
    const checked: string[] = [];
    const wanted = offered.find((item) => item.label === model)!;
    const reply = await prepareStudioQuoteRevision(
      { ...studioQuoteRevision(request, draft, 'Seedream 5.0 Flash', [source], 'fr'), alternatives: offered },
      'fr',
      async () => {
        throw Error('Suggesting a fallback must never prepare a different model.');
      },
      async (action) => {
        checked.push(action.modelId!);
        return action.modelId === wanted.action.modelId
          ? undefined
          : new AgentApiError('MODE_UNSUPPORTED', 'This mode is unavailable.');
      },
    );
    assert.ok(reply.reply.endsWith(model + ' ?'));
    assert.equal(checked.at(-1), wanted.action.modelId);
  }
  assert.deepEqual(
    studioRevisionAlternatives(
      { ...request, prompt: 'Show the dial of a watch at sunset.' },
      draft,
      [source],
      'en',
      'Product ad without people.',
    ).map((item) => item.label),
    ['Seedance 2.5'],
  );
});
