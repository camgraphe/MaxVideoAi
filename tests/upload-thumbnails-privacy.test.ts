import assert from 'node:assert/strict';
import test from 'node:test';

import { createUploadImageThumbnail } from '../frontend/server/upload-thumbnails';

test('thumbnail failures log only a stable code without private filenames or raw errors', async () => {
  const originalWarn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args: unknown[]) => { warnings.push(args); };
  try {
    const result = await createUploadImageThumbnail({
      data: Buffer.from('not-an-image'),
      fileName: 'private-user-secret.png',
      userId: 'private-user-id',
    });
    assert.equal(result, null);
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(warnings, [['[upload-thumbnails] code=IMAGE_THUMBNAIL_FAILED']]);
  assert.doesNotMatch(JSON.stringify(warnings), /private-user|not-an-image|StorageUploadError/iu);
});
