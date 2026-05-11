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

test('parses BytePlus Seedream streaming image responses', async () => {
  const response = await callBytePlusSeedream(
    {
      baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
      apiKey: 'test-key',
      payload: {
        model: 'seedream-5-0-260128',
        prompt: 'Create four coherent storyboard frames',
        size: '2K',
        response_format: 'url',
        watermark: false,
        stream: true,
      },
    },
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode(
                'event: image_generation.partial_succeeded\n' +
                  'data: {"id":"img_req_stream","data":[{"url":"https://example.com/generated-1.png"}]}\n\n'
              )
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
  );

  assert.deepEqual(response, {
    id: 'img_req_stream',
    data: [{ url: 'https://example.com/generated-1.png' }],
  });
});

test('collects BytePlus Seedream image URLs from streamed partial events', async () => {
  const response = await callBytePlusSeedream(
    {
      baseUrl: 'https://ark.ap-southeast.bytepluses.com/api/v3',
      apiKey: 'test-key',
      payload: {
        model: 'seedream-5-0-260128',
        prompt: 'Create two coherent storyboard frames',
        size: '2K',
        response_format: 'url',
        watermark: false,
        stream: true,
      },
    },
    async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode(
                'event: image_generation.partial_succeeded\n' +
                  'data: {"type":"image_generation.partial_succeeded","image_index":0,"url":"https://example.com/generated-1.jpeg","size":"2048x2048"}\n\n'
              )
            );
            controller.enqueue(
              encoder.encode(
                'event: image_generation.partial_succeeded\n' +
                  'data: {"type":"image_generation.partial_succeeded","image_index":1,"url":"https://example.com/generated-2.jpeg","size":"2048x2048"}\n\n'
              )
            );
            controller.enqueue(
              encoder.encode(
                'event: image_generation.completed\n' +
                  'data: {"type":"image_generation.completed","usage":{"generated_images":2}}\n\n' +
                  'data: [DONE]\n\n'
              )
            );
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } }
      )
  );

  assert.deepEqual(response, {
    type: 'image_generation.completed',
    usage: { generated_images: 2 },
    data: [
      {
        type: 'image_generation.partial_succeeded',
        image_index: 0,
        url: 'https://example.com/generated-1.jpeg',
        size: '2048x2048',
      },
      {
        type: 'image_generation.partial_succeeded',
        image_index: 1,
        url: 'https://example.com/generated-2.jpeg',
        size: '2048x2048',
      },
    ],
  });
});
