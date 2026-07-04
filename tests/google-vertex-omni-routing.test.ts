import assert from 'node:assert/strict';
import test from 'node:test';

import {
  GOOGLE_VERTEX_OMNI_PROVIDER,
  isGoogleVertexOmniEngine,
  resolveGoogleVertexOmniModelRoute,
  resolveGoogleVertexOmniSupport,
} from '../frontend/src/server/video-providers/google-vertex-omni/model-map';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';

test('Gemini Omni Flash model map uses the Vertex Agent Platform preview model id', () => {
  assert.equal(GOOGLE_VERTEX_OMNI_PROVIDER, 'google_vertex_omni_direct');
  assert.equal(isGoogleVertexOmniEngine('gemini-omni-flash'), true);

  const route = resolveGoogleVertexOmniModelRoute('gemini-omni-flash');
  assert.equal(route.providerModel, 'gemini-omni-flash-preview');
  assert.equal(route.launchStage, 'preview');
  assert.deepEqual(route.supportedModes, ['t2v', 'i2v', 'ref2v', 'v2v', 'retake']);
  assert.deepEqual(route.aspectRatios, ['16:9', '9:16']);
});

test('Gemini Omni Flash support rejects unsupported Veo-only controls', () => {
  const base = {
    engineId: 'gemini-omni-flash',
    mode: 't2v',
    aspectRatio: '16:9',
    prompt: 'Studio product ad',
  };

  assert.equal(resolveGoogleVertexOmniSupport({ ...base }).supported, true);
  assert.equal(resolveGoogleVertexOmniSupport({ ...base, aspectRatio: '1:1' }).reason, 'aspect_ratio_not_supported');
  assert.equal(resolveGoogleVertexOmniSupport({ ...base, mode: 'extend' }).reason, 'unsupported_mode');
  assert.equal(resolveGoogleVertexOmniSupport({ ...base, negativePrompt: 'bad anatomy' }).reason, 'negative_prompt_not_supported');
  assert.equal(resolveGoogleVertexOmniSupport({ ...base, seed: 123 }).reason, 'seed_not_supported');
});

test('Gemini Omni Flash routing is public when enabled and can be explicitly gated', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'gemini-omni-flash',
      mode: 't2v',
      isAdmin: false,
      env: {
        GOOGLE_VERTEX_OMNI_ENABLED: 'true',
      },
    }),
    {
      kind: 'google_vertex_omni_primary',
      primaryProvider: 'google_vertex_omni_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: false,
    }
  );

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'gemini-omni-flash',
      mode: 't2v',
      isAdmin: false,
      env: {
        GOOGLE_VERTEX_OMNI_ENABLED: 'true',
        GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED: 'false',
        GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'gemini-omni-flash',
      mode: 't2v',
      isAdmin: true,
      env: {
        GOOGLE_VERTEX_OMNI_ENABLED: 'true',
        GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'true',
      },
    }),
    {
      kind: 'google_vertex_omni_primary',
      primaryProvider: 'google_vertex_omni_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: false,
    }
  );
});
