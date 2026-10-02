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

test('public HTTP quotes admit the reviewed open integer domains without generic duration or token caps', async () => {
  const request = async (input: unknown) => POST(new NextRequest('http://localhost/api/pricing/quote', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }));
  const luma = { modelId: 'lumaRay2', mode: 'v2v', resolution: '720p', durationSec: 131 };
  const references = { modelId: 'minimax-h3-max', mode: 'ref2v', resolution: '768P', durationSec: 5, referenceTokenBudget: 20000 };
  assert.equal((await request(luma)).status, 200);
  assert.equal((await request(references)).status, 200);
  for (const quantity of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal((await request({ ...luma, durationSec: quantity })).status, 400);
    assert.equal((await request({ ...references, referenceTokenBudget: quantity })).status, 400);
  }
  assert.equal((await request({ ...luma, mode: 't2v' })).status, 400);
  assert.equal((await request({ ...references, modelId: 'pika-text-to-video' })).status, 400);
});
