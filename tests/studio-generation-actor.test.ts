import assert from 'node:assert/strict';
import test from 'node:test';
import { prepareGeneration, prepareGenerationForActor } from '../frontend/src/server/agent-api/prepare-generation';
import { confirmGeneration } from '../frontend/src/server/agent-api/confirm-generation';
import type { StudioGenerationActor } from '../frontend/src/server/agent-api/generation-actor';

const actor: StudioGenerationActor = { authMethod: 'studio-session', userId: 'owner', clientId: null, projectId: 'project' };
const image = { surface: 'image' as const, engineId: 'gpt-image-2', mode: 't2i' as const, prompt: 'A real image', references: [], outputCount: 1 };
test('public OAuth adapters reject a Studio actor before any dependency work', async () => {
  await assert.rejects(prepareGeneration(image, actor as never, {} as never), { code: 'AUTH_REQUIRED' });
  await assert.rejects(confirmGeneration({ quoteId: '123e4567-e89b-42d3-a456-426614174000', confirmed: true }, actor as never, {} as never), { code: 'AUTH_REQUIRED' });
});
test('session core is image-only, one output, owned references and wallet only', async () => {
  for (const input of [
    { ...image, surface: 'video', mode: 't2v' },
    { ...image, outputCount: 2 },
    { ...image, mode: 'i2i', references: [{ kind: 'https', url: 'https://cdn.example.com/unowned.png', role: 'reference', mediaKind: 'image' }] },
  ]) {
    await assert.rejects(prepareGenerationForActor(input as never, actor, {} as never), { code: 'PARAMETER_INVALID' });
  }
});
