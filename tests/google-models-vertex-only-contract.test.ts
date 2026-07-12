import assert from 'node:assert/strict';
import test from 'node:test';

import { listFalEngines } from '../frontend/src/config/falEngines.ts';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router.ts';

const GOOGLE_IMAGE_MODEL_IDS = {
  'nano-banana': 'gemini-2.5-flash-image',
  'nano-banana-lite': 'gemini-3.1-flash-lite-image',
  'nano-banana-2': 'gemini-3.1-flash-image',
  'nano-banana-pro': 'gemini-3-pro-image',
} as const;

test('every Nano Banana entry declares a Vertex image provider', () => {
  const entries = listFalEngines();

  for (const [id, modelSlug] of Object.entries(GOOGLE_IMAGE_MODEL_IDS)) {
    const entry = entries.find((candidate) => candidate.id === id);
    assert.ok(entry, `${id} should be registered`);
    assert.equal(entry.engine.providerMeta?.provider, 'google_vertex_image');
    assert.equal(entry.engine.providerMeta?.modelSlug, modelSlug);
  }
});

test('Google video routes never resolve to Fal', () => {
  for (const engineId of ['veo-3-1', 'veo-3-1-fast', 'veo-3-1-lite', 'gemini-omni-flash']) {
    const disabled = resolveVideoProviderRoutingPlan({ engineId, mode: 't2v', isAdmin: false, env: {} });
    assert.equal(disabled.kind, 'google_vertex_unavailable');

    const enabled = resolveVideoProviderRoutingPlan({
      engineId,
      mode: 't2v',
      isAdmin: false,
      env: {
        GOOGLE_VERTEX_VEO_ENABLED: 'true',
        GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'true',
        GOOGLE_VERTEX_OMNI_ENABLED: 'true',
        GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED: 'true',
      },
    });
    assert.notEqual(enabled.kind, 'fal_only');
    assert.equal('fallbackProvider' in enabled, false);
  }
});
