import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { transformSync } from 'esbuild';

function loadRoute() {
  const payloads: Record<string, unknown>[] = [];
  const module = { exports: {} as { POST(req: Request): Promise<Response> } };
  const source = readFileSync('frontend/app/api/fal/webhook/route.ts', 'utf8');
  const compiled = transformSync(source, { loader: 'ts', format: 'cjs', target: 'node22' }).code;
  new Function('require', 'module', 'exports', compiled)((name: string) => {
    if (name === 'next/server') return { NextResponse: { json: Response.json } };
    if (name === '@/server/fal-webhook-handler') return {
      updateJobFromFalWebhook: async (payload: Record<string, unknown>) => { payloads.push(payload); },
    };
    throw new Error(`Unexpected import: ${name}`);
  }, module, module.exports);
  return { POST: module.exports.POST, payloads };
}

test('authenticated callbacks correlate MCP UUIDs and existing job ids without trusting malformed ids', async () => {
  const previous = process.env.FAL_WEBHOOK_TOKEN;
  process.env.FAL_WEBHOOK_TOKEN = 'test-token';
  try {
    const { POST, payloads } = loadRoute();
    for (const jobId of ['a8d17a6b-44c1-4f6c-9bcc-913930128aad', 'job_123', 'tool_upscale_123']) {
      const response = await POST(new Request(`https://example.com/api/fal/webhook?token=test-token&jobId=${jobId}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request_id: 'provider_request', status: 'OK' }),
      }));
      assert.equal(response.status, 200);
      assert.equal(payloads.at(-1)?.job_id, jobId);
    }
    await POST(new Request('https://example.com/api/fal/webhook?token=test-token&jobId=not-a-job', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request_id: 'provider_request' }),
    }));
    assert.equal(payloads.at(-1)?.job_id, undefined);
    const count = payloads.length;
    const denied = await POST(new Request('https://example.com/api/fal/webhook?token=wrong&jobId=a8d17a6b-44c1-4f6c-9bcc-913930128aad', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request_id: 'provider_request' }),
    }));
    assert.equal(denied.status, 401);
    assert.equal(payloads.length, count);
    delete process.env.FAL_WEBHOOK_TOKEN;
    await POST(new Request('https://example.com/api/fal/webhook?jobId=a8d17a6b-44c1-4f6c-9bcc-913930128aad', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request_id: 'provider_request' }),
    }));
    assert.equal(payloads.at(-1)?.job_id, undefined);
  } finally {
    if (previous === undefined) delete process.env.FAL_WEBHOOK_TOKEN;
    else process.env.FAL_WEBHOOK_TOKEN = previous;
  }
});
