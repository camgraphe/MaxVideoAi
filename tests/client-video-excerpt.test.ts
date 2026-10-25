import assert from 'node:assert/strict';
import test from 'node:test';
import { requestVideoExcerpt } from '../frontend/lib/client-video-excerpt';
const input = {
  source: { type: 'asset', assetId: 'owned', kind: 'video' },
  engineId: 'luma-ray-3-2',
  mode: 'v2v',
  range: { startSec: 0, endSec: 5 },
} as const;
test('request boundary preserves structured server code/status without converting server message into user copy', async () => {
  await assert.rejects(
    requestVideoExcerpt(input, async () =>
      Response.json(
        { ok: false, error: { code: 'PREPARATION_LIMIT', message: 'Raw server detail' } },
        { status: 422 }
      )
    ),
    (error: any) => error.code === 'PREPARATION_LIMIT' && error.status === 422
  );
});
for (const [name, request, code] of [
  [
    'network',
    async () => {
      throw new TypeError('Raw browser detail');
    },
    'NETWORK_ERROR',
  ],
  ['invalid JSON', async () => new Response('invalid'), 'MALFORMED_RESPONSE'],
  [
    'unmeasured asset',
    async () => Response.json({ ok: true, asset: { id: 'id', url: 'https://example.invalid/result' } }),
    'MALFORMED_RESPONSE',
  ],
] as const)
  test(`request boundary classifies ${name} failures`, async () => {
    await assert.rejects(requestVideoExcerpt(input, request), (error: any) => error.code === code);
  });
