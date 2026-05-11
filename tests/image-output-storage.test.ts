import assert from 'node:assert/strict';
import test from 'node:test';

import { copyGeneratedImagesToStorage } from '../frontend/src/server/images/image-output-storage.ts';

test('copyGeneratedImagesToStorage replaces provider image URLs with stored media URLs', async () => {
  const images = [
    {
      url: 'https://ark-acg-ap-southeast-1.tos-ap-southeast-1.volces.com/seedream-5-0/output.jpeg?X-Tos-Expires=86400',
      thumbUrl: 'https://media.maxvideoai.com/rendersthumbs/user/output.webp',
    },
  ];

  const copied = await copyGeneratedImagesToStorage({
    images,
    jobId: 'img_test',
    userId: 'user_test',
    deps: {
      isStorageConfigured: () => true,
      extractStorageKeyFromUrl: () => null,
      fetch: async () =>
        new Response(Buffer.from([1, 2, 3]), {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        }),
      uploadImageToStorage: async () => ({
        url: 'https://media.maxvideoai.com/renders/images/user_test/output.jpeg',
        key: 'renders/images/user_test/output.jpeg',
        width: 5504,
        height: 3040,
        size: 3,
        mime: 'image/jpeg',
      }),
    },
  });

  assert.equal(copied[0]?.url, 'https://media.maxvideoai.com/renders/images/user_test/output.jpeg');
  assert.equal(copied[0]?.thumbUrl, images[0].thumbUrl);
  assert.equal(copied[0]?.width, 5504);
  assert.equal(copied[0]?.height, 3040);
  assert.equal(copied[0]?.mimeType, 'image/jpeg');
});
