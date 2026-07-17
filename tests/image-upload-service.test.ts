import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';

import sharp from 'sharp';

const servicePath = path.join(
  process.cwd(),
  'frontend/src/server/uploads/store-image-upload.ts'
);

async function loadService(): Promise<any> {
  assert.ok(fs.existsSync(servicePath), 'store-image-upload.ts must own image upload persistence');
  return import(pathToFileURL(servicePath).href);
}

function makeBmp24(width = 2, height = 1): Buffer {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelSize = rowSize * height;
  const bytes = Buffer.alloc(54 + pixelSize);
  bytes.write('BM', 0, 'ascii');
  bytes.writeUInt32LE(bytes.length, 2);
  bytes.writeUInt32LE(54, 10);
  bytes.writeUInt32LE(40, 14);
  bytes.writeInt32LE(width, 18);
  bytes.writeInt32LE(height, 22);
  bytes.writeUInt16LE(1, 26);
  bytes.writeUInt16LE(24, 28);
  bytes.writeUInt32LE(pixelSize, 34);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = 54 + y * rowSize + x * 3;
      bytes[offset] = 32;
      bytes[offset + 1] = 96;
      bytes[offset + 2] = 224;
    }
  }
  return bytes;
}

function fakeDecoded(bytes = Buffer.from('normalized')) {
  return {
    bytes,
    width: 640,
    height: 360,
    mimeType: 'image/webp',
    fileName: 'reference.webp',
    normalizedFromMime: 'image/tiff',
  };
}

function makeServiceDependencies(overrides: Record<string, unknown> = {}) {
  return {
    decodeImageUpload: async () => fakeDecoded(),
    ensureAssetSchema: async () => {},
    query: async () => [],
    uploadImageToStorage: async () => ({
      url: 'https://cdn.example.com/reference.webp',
      key: 'user-assets/user_1/reference.webp',
      width: 640,
      height: 360,
      size: 10,
      mime: 'image/webp',
    }),
    createUploadImageThumbnail: async () => 'https://cdn.example.com/reference-thumb.webp',
    recordUserAsset: async () => 'asset_new',
    ensureReusableAsset: async () => {},
    ...overrides,
  };
}

test('image upload persistence has a dedicated service with the public contract', async () => {
  const service = await loadService();
  assert.equal(typeof service.storeImageUpload, 'function');
  assert.equal(typeof service.createStoreImageUploadService, 'function');
});

test('image decoder accepts web-safe rasters, emits one GIF frame, and normalizes TIFF and BMP', async () => {
  const service = await loadService();
  const input = {
    create: {
      width: 3,
      height: 2,
      channels: 4 as const,
      background: { r: 220, g: 40, b: 90, alpha: 0.6 },
    },
  };
  const fixtures = [
    ['photo.jpg', 'image/jpeg', await sharp(input).jpeg().toBuffer(), 'image/jpeg'],
    ['graphic.png', 'image/png', await sharp(input).png().toBuffer(), 'image/png'],
    ['graphic.webp', 'image/webp', await sharp(input).webp().toBuffer(), 'image/webp'],
    ['motion.gif', 'image/gif', await sharp(input).gif().toBuffer(), 'image/gif'],
    ['graphic.avif', 'image/avif', await sharp(input).avif().toBuffer(), 'image/avif'],
    ['scan.tiff', 'image/tiff', await sharp(input).tiff().toBuffer(), 'image/jpeg'],
    ['legacy.bmp', 'image/bmp', makeBmp24(), 'image/jpeg'],
  ] as const;

  for (const [fileName, declaredMime, bytes, expectedMime] of fixtures) {
    const decoded = await service.decodeImageUpload({ fileName, declaredMime, bytes });
    assert.equal(decoded.mimeType, expectedMime, fileName);
    assert.ok(decoded.width > 0, fileName);
    assert.ok(decoded.height > 0, fileName);
    assert.ok(decoded.bytes.length > 0, fileName);
    if (fileName.endsWith('.gif')) {
      const outputMetadata = await sharp(decoded.bytes, { animated: true }).metadata();
      assert.equal(outputMetadata.pages ?? 1, 1, 'GIF uploads keep only their first frame');
    }
  }
});

test('image decoder rejects actual SVG data regardless of its declared MIME', async () => {
  const service = await loadService();
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>');

  await assert.rejects(
    service.decodeImageUpload({ fileName: 'fake.png', declaredMime: 'image/png', bytes: svg }),
    (error: any) => error?.code === 'UNSUPPORTED_TYPE'
  );
});

test('service enforces actual byte and decoded pixel caps before persistence', async () => {
  const service = await loadService();
  let decodeCalls = 0;
  let uploadCalls = 0;
  const store = service.createStoreImageUploadService(
    makeServiceDependencies({
      decodeImageUpload: async () => {
        decodeCalls += 1;
        return fakeDecoded();
      },
      uploadImageToStorage: async () => {
        uploadCalls += 1;
        throw new Error('must not upload');
      },
    })
  );

  await assert.rejects(
    store({
      userId: 'user_1',
      fileName: 'large.png',
      declaredMime: 'image/png',
      bytes: Buffer.alloc(service.MAX_IMAGE_UPLOAD_BYTES + 1),
    }),
    (error: any) => error?.code === 'FILE_TOO_LARGE'
  );
  assert.equal(decodeCalls, 0, 'byte limit must run before any decoder');

  const pixelStore = service.createStoreImageUploadService(
    makeServiceDependencies({
      decodeImageUpload: async () => ({
        ...fakeDecoded(),
        width: service.MAX_IMAGE_UPLOAD_PIXELS + 1,
        height: 1,
      }),
      uploadImageToStorage: async () => {
        uploadCalls += 1;
        throw new Error('must not upload');
      },
    })
  );
  await assert.rejects(
    pixelStore({
      userId: 'user_1',
      fileName: 'bomb.png',
      declaredMime: 'image/png',
      bytes: Buffer.from('small'),
    }),
    (error: any) => error?.code === 'UNSUPPORTED_TYPE'
  );
  assert.equal(uploadCalls, 0);

  const source = fs.readFileSync(servicePath, 'utf8');
  assert.match(source, /limitInputPixels:\s*MAX_IMAGE_UPLOAD_PIXELS/);
});

test('service deduplicates the normalized bytes without writing storage twice', async () => {
  const service = await loadService();
  const normalized = Buffer.from('canonical-webp');
  let queryParameters: unknown[] | undefined;
  let writeCalls = 0;
  const store = service.createStoreImageUploadService(
    makeServiceDependencies({
      decodeImageUpload: async () => fakeDecoded(normalized),
      query: async (_sql: string, parameters: unknown[]) => {
        queryParameters = parameters;
        return [
          {
            asset_id: 'asset_existing',
            url: 'https://cdn.example.com/existing.webp',
            mime_type: 'image/webp',
            width: 640,
            height: 360,
            size_bytes: '321',
            thumb_url: 'https://cdn.example.com/existing-thumb.webp',
          },
        ];
      },
      uploadImageToStorage: async () => {
        writeCalls += 1;
        throw new Error('must not upload a duplicate');
      },
      recordUserAsset: async () => {
        writeCalls += 1;
        return 'unexpected';
      },
    })
  );

  const result = await store({
    userId: 'user_1',
    fileName: 'reference.tiff',
    declaredMime: 'image/tiff',
    bytes: Buffer.from('original-tiff'),
  });

  assert.deepEqual(Object.keys(result).sort(), [
    'assetId',
    'height',
    'mimeType',
    'previewUrl',
    'sizeBytes',
    'width',
  ]);
  assert.deepEqual(result, {
    assetId: 'asset_existing',
    width: 640,
    height: 360,
    mimeType: 'image/webp',
    sizeBytes: 321,
    previewUrl: 'https://cdn.example.com/existing-thumb.webp',
  });
  assert.equal(queryParameters?.[0], 'user_1');
  assert.equal(
    queryParameters?.[1],
    service.createImageUploadContentHash(normalized),
    'dedupe hash must be computed from normalized bytes'
  );
  assert.equal(writeCalls, 0);
});

test('service uploads, records, mirrors, and returns the exact public projection', async () => {
  const service = await loadService();
  const normalized = Buffer.from('canonical-webp');
  const calls: Array<[string, any]> = [];
  const store = service.createStoreImageUploadService(
    makeServiceDependencies({
      decodeImageUpload: async () => fakeDecoded(normalized),
      uploadImageToStorage: async (params: any) => {
        calls.push(['upload', params]);
        return {
          url: 'https://cdn.example.com/reference.webp',
          key: 'user-assets/user_1/reference.webp',
          width: 640,
          height: 360,
          size: normalized.length,
          mime: 'image/webp',
        };
      },
      createUploadImageThumbnail: async (params: any) => {
        calls.push(['thumbnail', params]);
        return 'https://cdn.example.com/reference-thumb.webp';
      },
      recordUserAsset: async (params: any) => {
        calls.push(['record', params]);
        return 'asset_new';
      },
      ensureReusableAsset: async (params: any) => {
        calls.push(['mirror', params]);
      },
    })
  );

  const result = await store({
    userId: 'user_1',
    fileName: 'reference.tiff',
    declaredMime: 'image/tiff',
    bytes: Buffer.from('source-tiff'),
  });

  assert.deepEqual(result, {
    assetId: 'asset_new',
    width: 640,
    height: 360,
    mimeType: 'image/webp',
    sizeBytes: normalized.length,
    previewUrl: 'https://cdn.example.com/reference-thumb.webp',
  });
  assert.deepEqual(calls.map(([name]) => name), ['upload', 'thumbnail', 'record', 'mirror']);
  assert.deepEqual(calls[0][1], {
    data: normalized,
    mime: 'image/webp',
    fileName: 'reference.webp',
    userId: 'user_1',
    prefix: 'user-assets',
  });
  assert.deepEqual(calls[2][1].metadata, {
    originalName: 'reference.tiff',
    originalMime: 'image/tiff',
    normalizedFromMime: 'image/tiff',
    contentSha256: service.createImageUploadContentHash(normalized),
    thumbUrl: 'https://cdn.example.com/reference-thumb.webp',
  });
  assert.equal(calls[3][1].thumbUrl, 'https://cdn.example.com/reference-thumb.webp');
});

test('media_assets mirror failure stays non-fatal while upload and record failures are typed', async () => {
  const service = await loadService();
  const mirrorFailure = service.createStoreImageUploadService(
    makeServiceDependencies({
      ensureReusableAsset: async () => {
        throw new Error('mirror unavailable');
      },
    })
  );
  const result = await mirrorFailure({
    userId: 'user_1',
    fileName: 'reference.webp',
    declaredMime: 'image/webp',
    bytes: Buffer.from('source'),
  });
  assert.equal(result.assetId, 'asset_new');

  const uploadFailure = service.createStoreImageUploadService(
    makeServiceDependencies({
      uploadImageToStorage: async () => {
        throw new Error('storage unavailable');
      },
    })
  );
  await assert.rejects(
    uploadFailure({
      userId: 'user_1',
      fileName: 'reference.webp',
      declaredMime: 'image/webp',
      bytes: Buffer.from('source'),
    }),
    (error: any) => error?.code === 'UPLOAD_FAILED'
  );

  const recordFailure = service.createStoreImageUploadService(
    makeServiceDependencies({
      recordUserAsset: async () => {
        throw new Error('database unavailable');
      },
    })
  );
  await assert.rejects(
    recordFailure({
      userId: 'user_1',
      fileName: 'reference.webp',
      declaredMime: 'image/webp',
      bytes: Buffer.from('source'),
    }),
    (error: any) => error?.code === 'STORE_FAILED'
  );
});

test('upload failures emit only coarse event codes and never forward raw secret errors', async () => {
  const service = await loadService();
  const secret = 'private-key=user-secret https://signed.example.com/image?token=secret';
  const events: unknown[][] = [];
  const logImageUploadEvent = (...args: unknown[]) => {
    events.push(args);
  };
  const params = {
    userId: 'user_secret',
    fileName: 'private-reference.png',
    declaredMime: 'image/png',
    bytes: Buffer.from('source'),
  };

  const normalizationFailure = service.createStoreImageUploadService(
    makeServiceDependencies({
      logImageUploadEvent,
      decodeImageUpload: async () => {
        throw new Error(secret);
      },
    })
  );
  await assert.rejects(normalizationFailure(params));

  const uploadFailure = service.createStoreImageUploadService(
    makeServiceDependencies({
      logImageUploadEvent,
      uploadImageToStorage: async () => {
        throw new Error(secret);
      },
    })
  );
  await assert.rejects(uploadFailure(params));

  const mirrorFailure = service.createStoreImageUploadService(
    makeServiceDependencies({
      logImageUploadEvent,
      ensureReusableAsset: async () => {
        throw new Error(secret);
      },
    })
  );
  await mirrorFailure(params);

  const recordFailure = service.createStoreImageUploadService(
    makeServiceDependencies({
      logImageUploadEvent,
      recordUserAsset: async () => {
        throw new Error(secret);
      },
    })
  );
  await assert.rejects(recordFailure(params));

  assert.deepEqual(events, [
    ['warn', 'IMAGE_UPLOAD_NORMALIZATION_FAILED'],
    ['error', 'IMAGE_UPLOAD_STORAGE_FAILED'],
    ['warn', 'IMAGE_UPLOAD_MIRROR_FAILED'],
    ['error', 'IMAGE_UPLOAD_RECORD_FAILED'],
  ]);
  assert.doesNotMatch(JSON.stringify(events), /user-secret|signed\.example\.com|private-reference|user_secret/);

  const serviceSource = fs.readFileSync(servicePath, 'utf8');
  const handlerSource = fs.readFileSync(
    path.join(process.cwd(), 'frontend/src/server/uploads/create-image-upload-post-handler.ts'),
    'utf8'
  );
  assert.doesNotMatch(serviceSource + handlerSource, /console\.(?:error|warn)\([^\n]*,\s*error\b/);
});
