import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGoogleVertexImagePayload } from '../frontend/src/server/images/google-vertex-image-payload.ts';
import { extractGoogleVertexImages } from '../frontend/src/server/images/google-vertex-image-response.ts';

test('builds a Vertex generateContent image request with inline and GCS references', () => {
  const payload = buildGoogleVertexImagePayload({
    prompt: 'Editorial product image',
    referenceImages: [
      { data: 'aW1hZ2U=', mimeType: 'image/png' },
      { fileUri: 'gs://vertex-inputs/reference.jpg', mimeType: 'image/jpeg' },
    ],
    aspectRatio: '16:9',
    imageSize: '2k',
    enableWebSearch: true,
  });

  assert.deepEqual(payload.generationConfig.responseModalities, ['TEXT', 'IMAGE']);
  assert.equal(payload.contents[0]?.parts[0]?.text, 'Editorial product image');
  assert.equal(payload.contents[0]?.parts[1]?.inlineData?.mimeType, 'image/png');
  assert.equal(payload.contents[0]?.parts[2]?.fileData?.fileUri, 'gs://vertex-inputs/reference.jpg');
  assert.deepEqual(payload.tools, [{ googleSearch: {} }]);
  assert.deepEqual(payload.generationConfig.imageConfig, { aspectRatio: '16:9', imageSize: '2K' });
});

test('extracts inline images from Vertex candidates', () => {
  const images = extractGoogleVertexImages({
    responseId: 'response-1',
    candidates: [{ content: { parts: [{ text: 'Done' }, { inlineData: { mimeType: 'image/png', data: 'aW1hZ2U=' } }] } }],
  });

  assert.equal(images.length, 1);
  assert.equal(images[0]?.mimeType, 'image/png');
  assert.equal(images[0]?.data.toString(), 'image');
});
