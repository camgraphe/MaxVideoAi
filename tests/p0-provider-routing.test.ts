import assert from 'node:assert/strict';
import test from 'node:test';

import { getBytePlusSeedanceProfile } from '../frontend/src/server/video-providers/byteplus-modelark-profiles';
import { isGoogleVertexOmniEngine } from '../frontend/src/server/video-providers/google-vertex-omni/model-map';
import { isGoogleVertexVeoEngine } from '../frontend/src/server/video-providers/google-vertex-veo/model-map';
import { isKlingDirectEngine } from '../frontend/src/server/video-providers/kling-direct/model-map';
import { isLumaAgentsVideoEngine } from '../frontend/src/server/video-providers/luma-agents/model-map';
import {
  resolveVideoProviderRoutingPlan,
  type VideoProviderRoutingEnv,
} from '../frontend/src/server/video-providers/router';

const P0_MODES = {
  'wan-3': ['t2v', 'i2v', 'ref2v'],
  'wan-3-prime': ['t2v', 'i2v', 'ref2v'],
  'ltx-2-5-fast': ['t2v', 'i2v', 'a2v'],
  'ltx-2-5-pro': ['t2v', 'i2v', 'a2v'],
  'grok-imagine-video-1-5': ['t2v', 'i2v', 'ref2v'],
  'flux-3': ['t2v', 'i2v', 'fl2v', 'extend'],
  'flux-3-draft': ['t2v', 'i2v', 'fl2v', 'extend'],
} as const;

const allDirectFlags: VideoProviderRoutingEnv = {
  KLING_DIRECT_ENABLED: 'true',
  KLING_DIRECT_PUBLIC_ROUTING_ENABLED: 'true',
  KLING_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
  KLING_DIRECT_FALLBACK_ON_CREDITS_DEPLETED_ENABLED: 'true',
  KLING_DIRECT_ELEMENT_REGISTRATION_ENABLED: 'true',
  KLING_DIRECT_ADMIN_ONLY: 'false',
  LUMA_AGENTS_ENABLED: 'true',
  LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: 'true',
  LUMA_AGENTS_ADMIN_ONLY: 'false',
  LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED: 'true',
  LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED: 'true',
  LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
  GOOGLE_VERTEX_VEO_ENABLED: 'true',
  GOOGLE_VERTEX_VEO_PUBLIC_ROUTING_ENABLED: 'true',
  GOOGLE_VERTEX_VEO_PUBLIC_EXTEND_ROUTING_ENABLED: 'true',
  GOOGLE_VERTEX_VEO_INPUT_GCS_URI: 'gs://maxvideoai-test/inputs',
  GOOGLE_VERTEX_VEO_ADMIN_ONLY: 'false',
  GOOGLE_VERTEX_OMNI_ENABLED: 'true',
  GOOGLE_VERTEX_OMNI_PUBLIC_ROUTING_ENABLED: 'true',
  GOOGLE_VERTEX_OMNI_ADMIN_ONLY: 'false',
};

test('all seven P0 engines stay Fal-only even for admins with every existing direct flag enabled', () => {
  for (const [engineId, modes] of Object.entries(P0_MODES)) {
    assert.equal(Boolean(isKlingDirectEngine(engineId)), false, engineId);
    assert.equal(isLumaAgentsVideoEngine(engineId), false, engineId);
    assert.equal(isGoogleVertexVeoEngine(engineId), false, engineId);
    assert.equal(isGoogleVertexOmniEngine(engineId), false, engineId);
    assert.equal(getBytePlusSeedanceProfile(engineId), null, engineId);

    for (const mode of modes) {
      assert.deepEqual(resolveVideoProviderRoutingPlan({
        engineId,
        mode,
        isAdmin: true,
        env: allDirectFlags,
      }), {
        kind: 'fal_only',
        primaryProvider: 'fal',
        fallbackEnabled: false,
      }, `${engineId}/${mode}`);
    }
  }
});

test('existing approved direct routing remains intact beside the Fal-only P0 set', () => {
  assert.equal(resolveVideoProviderRoutingPlan({
    engineId: 'kling-3-pro', mode: 't2v', isAdmin: true, env: allDirectFlags,
  }).kind, 'kling_direct_primary');
  assert.equal(resolveVideoProviderRoutingPlan({
    engineId: 'luma-ray-3-2', mode: 't2v', isAdmin: true, env: allDirectFlags,
  }).kind, 'luma_agents_direct_primary');
  assert.equal(resolveVideoProviderRoutingPlan({
    engineId: 'veo-3-1', mode: 't2v', isAdmin: true, env: allDirectFlags,
  }).kind, 'google_vertex_veo_primary');
  assert.equal(resolveVideoProviderRoutingPlan({
    engineId: 'gemini-omni-flash', mode: 't2v', isAdmin: true, env: allDirectFlags,
  }).kind, 'google_vertex_omni_primary');
  assert.equal(getBytePlusSeedanceProfile('seedance-2-0')?.engineId, 'seedance-2-0');
});
