import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareGeneration, prepareGenerationForActor } from '../frontend/src/server/agent-api/prepare-generation';
import { confirmGeneration } from '../frontend/src/server/agent-api/confirm-generation';
import { bindStudioReferenceSnapshot, quoteMatchesActor, requireGenerationActor } from '../frontend/src/server/agent-api/generation-actor';
import { createQuoteRepository, generationQuoteCodec } from '../frontend/src/server/agent-api/quote-repository';

const actor = { authMethod: 'toolbox-session', userId: 'owner', clientId: null } as const;
const image = { surface: 'image' as const, engineId: 'gpt-image-2', mode: 'i2i' as const, prompt: 'Studio background', references: [{ kind: 'asset' as const, assetId: 'source', role: 'source' as const }], outputCount: 1 };

test('Tools has an explicit session actor and cannot masquerade as OAuth or Studio', async () => {
  assert.doesNotThrow(() => requireGenerationActor(actor as never));
  assert.throws(() => requireGenerationActor({ ...actor, clientId: 'oauth-client' } as never), { code: 'AUTH_REQUIRED' });
  await assert.rejects(prepareGeneration(image, actor as never, {} as never), { code: 'AUTH_REQUIRED' });
  await assert.rejects(confirmGeneration({ quoteId: '123e4567-e89b-42d3-a456-426614174000', confirmed: true }, actor as never, {} as never), { code: 'AUTH_REQUIRED' });
});

test('Tools quotes are wallet-only and isolated even for the same user with a null OAuth client', () => {
  const quote = { userId: 'owner', oauthClientId: null, authOrigin: 'toolbox-session', studioProjectId: null, fundingMode: 'wallet' };
  assert.equal(quoteMatchesActor(quote as never, actor as never), true);
  for (const change of [{ authOrigin: 'oauth' }, { authOrigin: 'studio-session' }, { userId: 'other' }, { fundingMode: 'trial' }, { studioProjectId: 'project' }]) {
    assert.equal(quoteMatchesActor({ ...quote, ...change } as never, actor as never), false);
  }
  assert.doesNotThrow(() => createQuoteRepository(generationQuoteCodec, { origin: 'toolbox-session' } as never));
});

test('Tools preparation refuses unowned URL references and output batches before dependencies', async () => {
  for (const input of [
    { ...image, outputCount: 2 },
    { ...image, references: [{ kind: 'https', url: 'https://example.com/source.png', role: 'source', mediaKind: 'image' }] },
  ]) await assert.rejects(prepareGenerationForActor(input as never, actor as never, {} as never), { code: 'PARAMETER_INVALID' });
});

test('Tools quote snapshots bind exact measured owned references, not only an asset ID', () => {
  const first = bindStudioReferenceSnapshot({ totalCents: 25 }, actor as never, [{ assetId: 'a', durationSec: 5, url: 'https://media.example/a' }] as never);
  const changed = bindStudioReferenceSnapshot({ totalCents: 25 }, actor as never, [{ assetId: 'a', durationSec: 6, url: 'https://media.example/a' }] as never);
  assert.equal(typeof first.toolboxReferenceFingerprint, 'string');
  assert.notEqual(first.toolboxReferenceFingerprint, changed.toolboxReferenceFingerprint);
});
