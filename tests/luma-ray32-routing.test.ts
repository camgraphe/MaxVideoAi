import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import {
  isLumaDirectEngine,
  resolveLumaDirectModelRoute,
} from '../frontend/src/server/video-providers/luma-direct/model-map';
import { resolveLumaDirectApiPath } from '../frontend/src/server/video-providers/luma-direct/client';
import { buildLumaDirectPayload } from '../frontend/src/server/video-providers/luma-direct/payload';
import { resolveVideoProviderRoutingPlan } from '../frontend/src/server/video-providers/router';

const root = process.cwd();

test('Luma Ray 3.2 router selects direct Luma primary with Fal fallback metadata', () => {
  assert.equal(isLumaDirectEngine('lumaRay3_2'), true);
  assert.equal(isLumaDirectEngine('luma-ray-3-2'), true);

  const route = resolveLumaDirectModelRoute('lumaRay3_2');
  assert.equal(route.providerModel, 'ray-3.2');
  assert.deepEqual(route.supportedModes, ['t2v', 'i2v', 'v2v', 'reframe']);
  assert.deepEqual(route.falFallbackModelIds, {
    t2v: 'luma/agent/ray/v3.2/text-to-video',
    i2v: 'luma/agent/ray/v3.2/image-to-video',
    v2v: 'luma/agent/ray/v3.2/video-to-video',
    reframe: 'luma/agent/ray/v3.2/reframe',
  });

  const plan = resolveVideoProviderRoutingPlan({
    engineId: 'lumaRay3_2',
    mode: 'v2v',
    isAdmin: true,
    env: {
      LUMA_DIRECT_ENABLED: 'true',
      LUMA_DIRECT_PUBLIC_ROUTING_ENABLED: 'false',
      LUMA_DIRECT_ADMIN_ONLY: 'true',
      LUMA_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
    },
  });

  assert.deepEqual(plan, {
    kind: 'luma_direct_primary',
    primaryProvider: 'luma_direct',
    fallbackProvider: 'fal',
    fallbackEnabled: true,
  });
});

test('Luma Ray 3.2 router keeps Fal when direct Luma is disabled or not allowed', () => {
  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'lumaRay3_2',
      mode: 't2v',
      isAdmin: true,
      env: {
        LUMA_DIRECT_ENABLED: 'false',
        LUMA_DIRECT_FALLBACK_TO_FAL_ENABLED: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'lumaRay3_2',
      mode: 't2v',
      isAdmin: false,
      env: {
        LUMA_DIRECT_ENABLED: 'true',
        LUMA_DIRECT_PUBLIC_ROUTING_ENABLED: 'false',
        LUMA_DIRECT_ADMIN_ONLY: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );

  assert.deepEqual(
    resolveVideoProviderRoutingPlan({
      engineId: 'lumaRay3_2',
      mode: 'extend',
      isAdmin: true,
      env: {
        LUMA_DIRECT_ENABLED: 'true',
        LUMA_DIRECT_PUBLIC_ROUTING_ENABLED: 'true',
      },
    }),
    { kind: 'fal_only', primaryProvider: 'fal', fallbackEnabled: false }
  );
});

test('Luma Ray 3.2 direct payload uses the Luma Agents request envelope', () => {
  const textPayload = buildLumaDirectPayload({
    engineId: 'lumaRay3_2',
    mode: 't2v',
    prompt: 'A slow dolly shot through a misty greenhouse',
    durationSec: 10,
    aspectRatio: '21:9',
    resolution: '1080p',
    falPayload: {
      engineId: 'lumaRay3_2',
      prompt: 'A slow dolly shot through a misty greenhouse',
      mode: 't2v',
      durationOption: '10s',
      aspectRatio: '21:9',
      resolution: '1080p',
      extraInputValues: {
        hdr: true,
        exr_export: true,
      },
    },
  });

  assert.deepEqual(textPayload.body, {
    model: 'ray-3.2',
    type: 'video',
    prompt: 'A slow dolly shot through a misty greenhouse',
    aspect_ratio: '21:9',
    video: {
      duration: '10s',
      resolution: '1080p',
      hdr: true,
      exr_export: true,
    },
  });

  const editPayload = buildLumaDirectPayload({
    engineId: 'luma-ray-3-2',
    mode: 'v2v',
    prompt: 'Transform the scene into moonlit 35mm footage',
    durationSec: 5,
    aspectRatio: null,
    resolution: '720p',
    falPayload: {
      engineId: 'lumaRay3_2',
      prompt: 'Transform the scene into moonlit 35mm footage',
      mode: 'v2v',
      videoUrl: 'https://example.com/source.mp4',
      resolution: '720p',
      extraInputValues: {
        edit_strength: 'flex_2',
        auto_controls: true,
      },
    },
  });

  assert.deepEqual(editPayload.body, {
    model: 'ray-3.2',
    type: 'video_edit',
    prompt: 'Transform the scene into moonlit 35mm footage',
    source: {
      url: 'https://example.com/source.mp4',
      media_type: 'video/mp4',
    },
    video: {
      resolution: '720p',
      edit: {
        strength: 'flex_2',
        auto_controls: true,
      },
    },
  });
});

test('Luma direct client normalizes versioned API paths against the v1 base URL', () => {
  assert.equal(resolveLumaDirectApiPath('/v1/generations'), '/generations');
  assert.equal(resolveLumaDirectApiPath('/v1/generations/luma-job-1'), '/generations/luma-job-1');
  assert.equal(resolveLumaDirectApiPath('/generations/luma-job-2'), '/generations/luma-job-2');
});

test('Luma Ray 3.2 direct routing has an explicit generate submission branch', () => {
  const submissionSource = readFileSync(
    join(root, 'frontend/app/api/generate/_lib/video-provider-submission.ts'),
    'utf8'
  );
  const routeContextSource = readFileSync(join(root, 'frontend/app/api/generate/_lib/route-context.ts'), 'utf8');

  assert.match(submissionSource, /submitLumaDirectGenerateTask/);
  assert.match(submissionSource, /providerRoutingPlan\.kind === 'luma_direct_primary'/);
  assert.match(routeContextSource, /isLumaDirectEngine/);
});
