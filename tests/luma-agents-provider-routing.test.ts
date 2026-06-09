import assert from 'node:assert/strict';
import test from 'node:test';

import type { GeneratePayload } from '../frontend/src/lib/fal-types';
import {
  isLumaAgentsVideoModeSupported,
  resolveLumaAgentsVideoSupport,
} from '../frontend/src/server/video-providers/luma-agents/model-map';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';

test('Luma Agents routes Ray 3.2 direct for admins when enabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 't2v',
      isAdmin: true,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: 'false',
        LUMA_AGENTS_ADMIN_ONLY: 'true',
        LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    }),
    {
      kind: 'luma_agents_direct_primary',
      primaryProvider: 'luma_agents_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: true,
      advancedDirectOnlyEnabled: false,
    }
  );
});

test('Luma Agents stays fal-only for public users until public routing is enabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 't2v',
      isAdmin: false,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: 'false',
        LUMA_AGENTS_ADMIN_ONLY: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );
});

test('Luma Agents routes public requests when public routing is enabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 'i2v',
      isAdmin: false,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_PUBLIC_ROUTING_ENABLED: 'true',
        LUMA_AGENTS_ADMIN_ONLY: 'false',
        LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    }),
    {
      kind: 'luma_agents_direct_primary',
      primaryProvider: 'luma_agents_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: true,
      advancedDirectOnlyEnabled: false,
    }
  );
});

test('Luma Agents keeps fal fallback for public modes when advanced flag is enabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 't2v',
      isAdmin: true,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED: 'true',
        LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    }),
    {
      kind: 'luma_agents_direct_primary',
      primaryProvider: 'luma_agents_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: true,
      advancedDirectOnlyEnabled: true,
    }
  );
});

test('Luma Agents advanced modes stay fal-only unless advanced direct-only flag is enabled', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 'reframe',
      isAdmin: true,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED: 'false',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 'reframe',
      isAdmin: true,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED: 'true',
        LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    }),
    {
      kind: 'luma_agents_direct_primary',
      primaryProvider: 'luma_agents_direct',
      fallbackProvider: 'fal',
      fallbackEnabled: false,
      advancedDirectOnlyEnabled: true,
    }
  );
});

test('Luma Agents keeps extend fal-only even when advanced direct-only flag is enabled', () => {
  assert.equal(isLumaAgentsVideoModeSupported('extend', { advancedDirectOnlyEnabled: true }), false);
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'luma-ray-3-2',
      mode: 'extend',
      isAdmin: true,
      env: {
        LUMA_AGENTS_ENABLED: 'true',
        LUMA_AGENTS_VIDEO_DIRECT_ENABLED: 'true',
        LUMA_AGENTS_ADVANCED_DIRECT_ONLY_ENABLED: 'true',
        LUMA_AGENTS_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );
});

test('Luma Agents support marks loop plus end frame as fal-compatible direct unsupported', () => {
  const falPayload: GeneratePayload = {
    engineId: 'luma-ray-3-2',
    prompt: 'Animate between these frames',
    mode: 'i2v',
    durationSec: 5,
    durationOption: '5s',
    aspectRatio: '16:9',
    resolution: '720p',
    loop: true,
    imageUrl: 'https://cdn.maxvideoai.com/start.png',
    endImageUrl: 'https://cdn.maxvideoai.com/end.png',
  };

  for (const advancedDirectOnlyEnabled of [false, true]) {
    const support = resolveLumaAgentsVideoSupport({
      engineId: 'luma-ray-3-2',
      mode: 'i2v',
      falPayload,
      advancedDirectOnlyEnabled,
    });

    assert.equal(support.supported, false);
    assert.equal(support.reason, 'loop_incompatible_with_end_frame');
    assert.equal(support.fallbackCompatible, true);
  }
});
