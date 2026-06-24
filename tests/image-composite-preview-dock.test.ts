import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync('frontend/components/groups/ImageCompositePreviewDock.tsx', 'utf8');

test('image composite main preview uses stable media urls during polling refreshes', () => {
  assert.match(
    source,
    /const selectedPreviewUrl =\s*resolveStableMediaUrl\(selected\?\.url,\s*selected\?\.thumbUrl\)\s*\?\?\s*selected\?\.url\s*\?\?\s*selected\?\.thumbUrl\s*\?\?\s*null;/,
    'the large composite preview should avoid temporary provider URLs that can change on refresh'
  );
  assert.match(
    source,
    /src=\{image\.thumbUrl \?\? image\.url\}/,
    'the small image selector can keep using thumbnails'
  );
});
