import assert from 'node:assert/strict';
import test from 'node:test';
import { validReferenceMediaUrl } from '../frontend/src/server/agent-api/reference-assets';

test('existing reference URL policy accepts exact signed originals without rewriting and rejects unsafe schemes', () => {
  const signed = 'https://media.maxvideoai.com/source.wav?signature=one%2Ftwo&plus=+';
  assert.equal(validReferenceMediaUrl(signed), true);
  for (const url of ['javascript:alert(1)', 'data:audio/wav;base64,AA', 'http://media.maxvideoai.com/a.wav', 'https://user:password@media.maxvideoai.com/a.wav', 'https://media.maxvideoai.com/a.wav#fragment', 'https://unapproved.invalid/a.wav', 'https://media.maxvideoai.com/']) assert.equal(validReferenceMediaUrl(url), false);
});
