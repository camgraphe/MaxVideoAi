import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const nextConfigSource = readFileSync('frontend/next.config.js', 'utf8');

test('Next image local patterns cover public asset directories used by marketing pages', () => {
  for (const pattern of [
    '/assets/**',
    '/brand/**',
    '/examples/**',
    '/hero/**',
    '/icons/**',
    '/images/**',
    '/og/**',
  ]) {
    assert.match(nextConfigSource, new RegExp(`pathname: '${pattern.replaceAll('*', '\\*')}'`), `${pattern} should be allowed for next/image`);
  }

  assert.match(
    nextConfigSource,
    /pathname: '\/assets\/tools\/character-builder-workspace\.png', search: '\?hero=1'/,
    'character builder hero query image should stay explicitly documented'
  );
});

test('Next image remote patterns cover Seedream BytePlus output URLs', () => {
  assert.match(
    nextConfigSource,
    /hostname: '\*\*\.volces\.com', pathname: '\/seedream-5-0\/\*\*'/,
    'Seedream BytePlus signed output URLs should be allowed when full-size previews use next/image'
  );
});
