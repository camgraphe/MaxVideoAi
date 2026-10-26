import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { KLING_V4_ENGINE } from '../frontend/src/config/fal-engines/kling-v4';
import { studioVisualCapabilityDetails } from '../frontend/src/server/studio/conversation-capabilities';
import { projectAgentModelModeDetails } from '../frontend/src/server/agent-api/model-details';
import { studioMediaIntentSchema } from '../frontend/lib/studio/conversation-media-contract';
import type { AgentPublicGenerationEngine } from '../frontend/src/server/agent-api/model-catalog';

for (const id of ['kling-3-turbo-standard', 'kling-3-turbo-pro', 'kling-v4']) {
  test(`${id} Studio discovery and actual action admission agree on structured shots`, () => {
    const engine = id === 'kling-v4' ? KLING_V4_ENGINE : getFalEngineById(id)!.engine;
    const candidate: AgentPublicGenerationEngine = { engine, surface: 'video', publicModes: engine.modes, modeCaps: engine.modeCaps! };
    const canonical = projectAgentModelModeDetails(candidate, 't2v');
    assert.ok(canonical.settings.some(setting => setting.type === 'multi_prompt'), 'provider/canonical support remains intact');
    const details = studioVisualCapabilityDetails(candidate);
    assert.ok(details.surface !== 'audio');
    const advertised = details.modes.find(mode => mode.mode === 't2v')!.settings.some(setting => setting.type === 'multi_prompt');
    const action = { action: 'video.prepare', reply: 'Review.', modelId: id, mode: 't2v', aspectRatio: '16:9', source: null };
    const shotPlan = [{ prompt: 'An actor walks.', durationSec: 3 }];
    const accepted = studioMediaIntentSchema.safeParse({ ...action, prompt: '', shotPlan }).success;
    assert.equal(advertised, accepted, 'following discovery must produce an admissible action');
    assert.equal(advertised, id === 'kling-v4');
    assert.equal(studioMediaIntentSchema.safeParse({ ...action, prompt: 'An actor walks.' }).success, true);
  });
}
