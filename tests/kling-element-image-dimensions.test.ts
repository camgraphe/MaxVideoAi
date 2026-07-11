import assert from 'node:assert/strict';
import test from 'node:test';

import { validateKlingElementImageDimensions } from '../frontend/app/api/generate/_lib/kling-element-image-dimensions';

const referenceUrl = 'https://media.maxvideoai.com/user-assets/user/logo.png';

function dimensionRows(width: number | string | null, height: number | string | null) {
  return [
    {
      asset_id: 'logo_asset',
      url: referenceUrl,
      width,
      height,
    },
  ];
}

function klingElement() {
  return {
    referenceAssetIds: ['logo_asset'],
    referenceImageUrls: [referenceUrl],
  };
}

test('rejects a Kling element image when height is below 300 px', async () => {
  const result = await validateKlingElementImageDimensions({
    engineId: 'kling-3-pro',
    userId: 'user',
    elements: [klingElement()],
    deps: {
      queryFn: async <T>(_sql: string, params?: unknown[]) => {
        assert.equal(params?.[0], 'user');
        return dimensionRows(648, 157) as T[];
      },
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.status, 422);
  assert.deepEqual(result.body, {
    ok: false,
    error: 'KLING_ELEMENT_IMAGE_TOO_SMALL',
    message:
      'This image is 648 x 157 px. Kling requires at least 300 px in width and 300 px in height. Choose a larger image and try again.',
    actualWidth: 648,
    actualHeight: 157,
    minimumWidth: 300,
    minimumHeight: 300,
  });
  assert.deepEqual(result.metric, {
    errorCode: 'KLING_ELEMENT_IMAGE_TOO_SMALL',
    meta: {
      actualWidth: 648,
      actualHeight: 157,
      minimumWidth: 300,
      minimumHeight: 300,
    },
  });
});

test('rejects a Kling element image when width is below 300 px', async () => {
  const result = await validateKlingElementImageDimensions({
    engineId: 'kling-3-standard',
    userId: 'user',
    elements: [klingElement()],
    deps: {
      queryFn: async <T>() => dimensionRows(299, 600) as T[],
    },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.body.actualWidth, 299);
  assert.equal(result.body.actualHeight, 600);
  assert.equal(
    result.body.message,
    'This image is 299 x 600 px. Kling requires at least 300 px in width and 300 px in height. Choose a larger image and try again.'
  );
});

test('accepts a Kling element image at the 300 x 300 boundary', async () => {
  const result = await validateKlingElementImageDimensions({
    engineId: 'kling-3-pro',
    userId: 'user',
    elements: [klingElement()],
    deps: {
      queryFn: async <T>() => dimensionRows('300', '300') as T[],
    },
  });

  assert.deepEqual(result, { ok: true });
});

test('accepts a Kling element image when stored dimensions are unknown', async () => {
  const result = await validateKlingElementImageDimensions({
    engineId: 'kling-3-pro',
    userId: 'user',
    elements: [klingElement()],
    deps: {
      queryFn: async <T>() => dimensionRows(null, null) as T[],
    },
  });

  assert.deepEqual(result, { ok: true });
});

test('skips dimension lookup for non-Kling engines', async () => {
  let queried = false;
  const result = await validateKlingElementImageDimensions({
    engineId: 'seedance-2-0',
    userId: 'user',
    elements: [klingElement()],
    deps: {
      queryFn: async <T>() => {
        queried = true;
        return dimensionRows(100, 100) as T[];
      },
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(queried, false);
});
