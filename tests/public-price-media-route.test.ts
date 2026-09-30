import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../frontend/app/api/pricing/quote/route';

test('public price endpoint accepts reviewed fractional media timing and rejects fractional requested fixed-duration timing', async () => {
  const request = async (input: unknown) => POST(new NextRequest('http://localhost/api/pricing/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }));
  const valid = await request({ modelId: 'ltx-2-5-fast', mode: 'a2v', resolution: '1080p', durationSec: 9.25,
    inputAudioDurationSec: 9.25 });
  assert.equal(valid.status, 200, 'Unavailable policy evidence is a 200 unavailable quote, rather than malformed input.');
  const invalid = await request({ modelId: 'ltx-2-5-fast', mode: 't2v', resolution: '1080p', durationSec: 9.25 });
  assert.equal(invalid.status, 400);
  assert.equal((await request({ modelId: 'gemini-omni-flash', mode: 'retake', resolution: '720p', durationSec: 4.75,
    inheritedDurationSec: -1 })).status, 400);
});
