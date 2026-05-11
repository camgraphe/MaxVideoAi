import assert from 'node:assert/strict';
import test from 'node:test';

import { extractBytePlusSeedreamImages, parseBytePlusSeedreamRequestId } from '../frontend/src/server/images/byteplus-seedream-response.ts';

test('extracts image URLs from BytePlus Seedream response data', () => {
  const images = extractBytePlusSeedreamImages({
    id: 'img_req_123',
    data: [
      {
        url: 'https://example.com/generated.png',
        revised_prompt: 'Clean product reference image',
      },
    ],
  });

  assert.deepEqual(images, [
    {
      url: 'https://example.com/generated.png',
      seed: null,
      mimeType: null,
      width: null,
      height: null,
    },
  ]);
});

test('returns an empty list when BytePlus response contains no images', () => {
  assert.deepEqual(extractBytePlusSeedreamImages({ data: [] }), []);
});

test('parses BytePlus request id from response metadata', () => {
  assert.equal(parseBytePlusSeedreamRequestId({ id: 'img_req_123' }), 'img_req_123');
});

