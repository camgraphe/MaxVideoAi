import assert from 'node:assert/strict';
import test from 'node:test';
import { listAngleToolEngines } from '../frontend/src/config/tools-angle-engines';
import { buildAngleFalInput } from '../frontend/src/server/tools/angle-request-utils';

for (const engine of listAngleToolEngines()) {
  test(`Angle sends the selected zoom in the fal request for ${engine.label}`, () => {
    const imageUrl = 'https://example.com/source.png';

    for (const [zoom, expectedZoom] of [[0, 0], [2.36, 2.4], [10, 10]]) {
      assert.deepEqual(
        buildAngleFalInput(engine, imageUrl, { rotation: 90, tilt: 0, zoom }),
        {
          image_urls: [imageUrl],
          horizontal_angle: 90,
          vertical_angle: 0,
          zoom: expectedZoom,
          num_images: 1,
        }
      );
    }
  });
}
