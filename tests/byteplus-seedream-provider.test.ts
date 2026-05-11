import assert from 'node:assert/strict';
import test from 'node:test';

import { callBytePlusSeedream } from '../frontend/src/server/images/byteplus-seedream-client.ts';

test('calls BytePlus Seedream images endpoint with bearer auth', async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const response = await callBytePlusSeedream(
    {
      baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
      apiKey: 'test-key',
      payload: {
        model: 'seedream-5-0-260128',
        prompt: 'Clean product reference image',
        size: '2K',
        response_format: 'url',
        watermark: false,
      },
    },
    async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          id: 'img_req_123',
          data: [{ url: 'https://example.com/generated.png' }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer test-key');
  assert.deepEqual(response, {
    id: 'img_req_123',
    data: [{ url: 'https://example.com/generated.png' }],
  });
});

test('throws a sanitized BytePlus error on non-2xx responses', async () => {
  await assert.rejects(
    () =>
      callBytePlusSeedream(
        {
          baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
          apiKey: 'test-key',
          payload: {
            model: 'seedream-5-0-260128',
            prompt: 'Clean product reference image',
            size: '2K',
            response_format: 'url',
            watermark: false,
          },
        },
        async () =>
          new Response(JSON.stringify({ error: { message: 'rejected' } }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          })
      ),
    /BytePlus Seedream generation failed/
  );
});
