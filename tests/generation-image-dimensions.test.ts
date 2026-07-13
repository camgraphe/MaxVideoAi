import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

import { validateGenerationImageDimensions } from '../frontend/app/api/generate/_lib/generation-image-dimensions';
import { listFalEngines } from '../frontend/src/config/falEngines';

const smallImageUrl = 'https://media.maxvideoai.com/user-assets/user/wide-banner.png';

test('all Seedance and Kling engines that accept images require a 300 px minimum side', () => {
  const imageEngines = listFalEngines().filter((entry) => {
    if (!entry.id.startsWith('seedance-') && !entry.id.startsWith('kling-')) return false;
    const fields = [
      ...(entry.engine.inputSchema?.required ?? []),
      ...(entry.engine.inputSchema?.optional ?? []),
    ];
    return fields.some((field) => field.type === 'image');
  });

  assert.deepEqual(
    imageEngines.map((entry) => entry.id).sort(),
    [
      'kling-2-5-turbo',
      'kling-2-6-pro',
      'kling-3-4k',
      'kling-3-pro',
      'kling-3-standard',
      'kling-o3-4k',
      'kling-o3-pro',
      'kling-o3-standard',
      'seedance-1-5-pro',
      'seedance-2-0',
      'seedance-2-0-fast',
      'seedance-2-0-mini',
    ]
  );
  for (const entry of imageEngines) {
    assert.equal(
      entry.engine.inputSchema?.constraints?.minImageSidePx,
      300,
      `${entry.id} should reject images below 300 px on either side`
    );
  }
});

test('rejects a 648 x 157 Seedance Mini input before provider submission', async () => {
  const result = await validateGenerationImageDimensions({
    engineId: 'seedance-2-0-mini',
    userId: 'user',
    attachments: [
      {
        name: 'wide-banner.png',
        type: 'image/png',
        size: 12_000,
        kind: 'image',
        slotId: 'image_url',
        url: smallImageUrl,
        width: 648,
        height: 157,
      },
    ],
    deps: {
      queryFn: async <T>() => [] as T[],
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 422);
  assert.deepEqual(result.body, {
    ok: false,
    error: 'IMAGE_DIMENSIONS_TOO_SMALL',
    message:
      'This image is 648 x 157 px. Dreamina Seedance 2.0 Mini requires at least 300 x 300 px. Choose a larger image and try again.',
    actualWidth: 648,
    actualHeight: 157,
    minimumWidth: 300,
    minimumHeight: 300,
  });
});

test('rejects a small regular Kling input, not only Kling element images', async () => {
  const result = await validateGenerationImageDimensions({
    engineId: 'kling-3-pro',
    userId: 'user',
    attachments: [
      {
        name: 'portrait.png',
        type: 'image/png',
        size: 12_000,
        kind: 'image',
        slotId: 'image_url',
        url: smallImageUrl,
        width: 299,
        height: 600,
      },
    ],
    deps: {
      queryFn: async <T>() => [] as T[],
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.body.actualWidth, 299);
  assert.equal(result.body.actualHeight, 600);
  assert.match(result.body.message, /Kling 3 Pro requires at least 300 x 300 px/);
});

test('uses stored asset dimensions instead of trusting larger client dimensions', async () => {
  const result = await validateGenerationImageDimensions({
    engineId: 'seedance-2-0-mini',
    userId: 'user',
    attachments: [
      {
        name: 'wide-banner.png',
        type: 'image/png',
        size: 12_000,
        kind: 'image',
        slotId: 'image_url',
        url: smallImageUrl,
        width: 1200,
        height: 1200,
        assetId: 'wide_banner_asset',
      },
    ],
    deps: {
      queryFn: async <T>(_sql: string, params?: unknown[]) => {
        assert.equal(params?.[0], 'user');
        return [
          {
            asset_id: 'wide_banner_asset',
            url: smallImageUrl,
            width: 648,
            height: 157,
          },
        ] as T[];
      },
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.body.actualWidth, 648);
  assert.equal(result.body.actualHeight, 157);
});

test('keeps validating stored Kling element images through the generic guard', async () => {
  const result = await validateGenerationImageDimensions({
    engineId: 'kling-o3-pro',
    userId: 'user',
    elements: [
      {
        referenceAssetIds: ['wide_banner_asset'],
        referenceImageUrls: [smallImageUrl],
      },
    ],
    deps: {
      queryFn: async <T>() => [
        {
          asset_id: 'wide_banner_asset',
          url: smallImageUrl,
          width: 648,
          height: 157,
        },
      ] as T[],
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.body.actualHeight, 157);
  assert.match(result.body.message, /Kling 3\.0 Omni Pro requires at least 300 x 300 px/);
});

test('accepts the exact 300 x 300 boundary', async () => {
  const result = await validateGenerationImageDimensions({
    engineId: 'seedance-1-5-pro',
    userId: 'user',
    attachments: [
      {
        name: 'boundary.png',
        type: 'image/png',
        size: 12_000,
        kind: 'image',
        url: smallImageUrl,
        width: 300,
        height: 300,
      },
    ],
    deps: {
      queryFn: async <T>() => [] as T[],
    },
  });

  assert.deepEqual(result, { ok: true });
});

test('validates all constrained generation images before billing preflight', () => {
  const source = readFileSync(join(process.cwd(), 'frontend/app/api/generate/route.ts'), 'utf8');

  assert.match(source, /validateGenerationImageDimensions/);
  assert.ok(
    source.indexOf('await validateGenerationImageDimensions') <
      source.indexOf('await resolveGenerateBillingPreflight'),
    'image dimensions must be validated before billing preflight'
  );
});
