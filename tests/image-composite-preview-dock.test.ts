import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('frontend/components/groups/ImageCompositePreviewDock.tsx', 'utf8');

test('image composite main preview prefers the full render URL over thumbnails', () => {
  assert.match(
    source,
    /const selectedPreviewUrl = selected\?\.url \?\? selected\?\.thumbUrl \?\? null;/,
    'the large composite preview should display the full-quality render URL'
  );
  assert.match(
    source,
    /src=\{image\.thumbUrl \?\? image\.url\}/,
    'the small image selector can keep using thumbnails'
  );
});
