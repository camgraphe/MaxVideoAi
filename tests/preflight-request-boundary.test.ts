import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { NextRequest } from 'next/server';

import { createPreflightPostHandler } from '../frontend/app/api/preflight/_lib/preflight-handler.ts';

type BoundaryModule = typeof import('../frontend/app/api/preflight/_lib/preflight-request.ts');

const MODULE_PATH = '../frontend/app/api/preflight/_lib/preflight-request.ts';

async function loadBoundary(): Promise<BoundaryModule> {
  return import(MODULE_PATH) as Promise<BoundaryModule>;
}

function validBody() {
  return {
    engine: 'grok-imagine-video-1-5',
    mode: 'ref2v',
    durationSec: 6,
    resolution: '720p',
    aspectRatio: '16:9',
    fps: 24,
    inputs: [{
      assetId: 'persisted-ref',
      slotId: 'reference_image_urls',
      kind: 'image',
      url: 'https://cdn.maxvideoai.com/private/reference.png',
    }],
    user: { memberTier: 'Member' },
  };
}

test('preflight boundary projects an exact persisted-reference payload', async () => {
  const { parsePreflightRequestPayload } = await loadBoundary();
  const parsed = parsePreflightRequestPayload(validBody());
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.deepEqual(parsed.request.inputs, validBody().inputs);
});

test('preflight boundary rejects unknown and execution-only fields deterministically', async () => {
  const { parsePreflightRequestPayload } = await loadBoundary();
  const attacks = [
    { ...validBody(), unknownTopLevel: true },
    { ...validBody(), inputs: [{ ...validBody().inputs[0], dataUrl: 'data:image/png;base64,c2VjcmV0' }] },
    { ...validBody(), inputs: [{ ...validBody().inputs[0], durationSec: 10 }] },
    { ...validBody(), inputs: [{ ...validBody().inputs[0], width: 1920 }] },
    JSON.parse(`{"${'__proto__'}":{"polluted":true},"engine":"grok-imagine-video-1-5","mode":"ref2v","durationSec":6,"resolution":"720p","fps":24}`),
  ];

  for (const attack of attacks) {
    const parsed = parsePreflightRequestPayload(attack);
    assert.deepEqual(parsed, {
      ok: false,
      status: 400,
      response: {
        ok: false,
        messages: ['Invalid preflight request.'],
        error: { code: 'PREFLIGHT_REQUEST_INVALID', message: 'Invalid preflight request.' },
      },
    });
    assert.doesNotMatch(JSON.stringify(parsed), /c2VjcmV0|reference\.png/);
  }
});

test('preflight boundary bounds arrays, strings, roles, kinds, and nested extra values', async () => {
  const { parsePreflightRequestPayload, MAX_PREFLIGHT_INPUTS } = await loadBoundary();
  const baseInput = validBody().inputs[0];
  const invalidBodies = [
    { ...validBody(), inputs: Array.from({ length: MAX_PREFLIGHT_INPUTS + 1 }, () => baseInput) },
    { ...validBody(), inputs: [{ ...baseInput, assetId: 'a'.repeat(257) }] },
    { ...validBody(), inputs: [{ ...baseInput, slotId: 'UNKNOWN ROLE' }] },
    { ...validBody(), inputs: [{ ...baseInput, kind: 'document' }] },
    { ...validBody(), inputs: [{ ...baseInput, url: 'javascript:alert(1)' }] },
    { ...validBody(), extraInputValues: { nested: { dangerous: true } } },
    { ...validBody(), user: { memberTier: 'Member', admin: true } },
  ];
  for (const body of invalidBodies) {
    const parsed = parsePreflightRequestPayload(body);
    assert.equal(parsed.ok, false);
    if (parsed.ok) continue;
    assert.equal(parsed.status, 400);
    assert.equal(parsed.response.error?.code, 'PREFLIGHT_REQUEST_INVALID');
  }
});

test('preflight body reader rejects declared and actual oversized bodies before JSON projection', async () => {
  const { MAX_PREFLIGHT_BODY_BYTES, readPreflightRequest } = await loadBoundary();
  let reads = 0;
  const declared = await readPreflightRequest({
    headers: new Headers({ 'content-length': String(MAX_PREFLIGHT_BODY_BYTES + 1) }),
    text: async () => {
      reads += 1;
      return JSON.stringify(validBody());
    },
  });
  assert.equal(declared.ok, false);
  if (!declared.ok) {
    assert.equal(declared.status, 413);
    assert.equal(declared.response.error?.code, 'PREFLIGHT_REQUEST_TOO_LARGE');
  }
  assert.equal(reads, 0);

  const actual = await readPreflightRequest({
    headers: new Headers(),
    text: async () => JSON.stringify({ ...validBody(), padding: 'x'.repeat(MAX_PREFLIGHT_BODY_BYTES) }),
  });
  assert.equal(actual.ok, false);
  if (!actual.ok) {
    assert.equal(actual.status, 413);
    assert.equal(actual.response.error?.code, 'PREFLIGHT_REQUEST_TOO_LARGE');
  }
});

test('preflight body reader cancels an oversized chunked body without buffering the full request', async () => {
  const { MAX_PREFLIGHT_BODY_BYTES, readPreflightRequest } = await loadBoundary();
  const chunk = new Uint8Array(Math.floor(MAX_PREFLIGHT_BODY_BYTES / 2));
  const totalChunks = 20;
  let chunksRead = 0;
  let cancelCalls = 0;
  let textCalls = 0;
  const reader = {
    read: async () => {
      chunksRead += 1;
      return chunksRead <= totalChunks
        ? { done: false as const, value: chunk }
        : { done: true as const, value: undefined };
    },
    cancel: async () => {
      cancelCalls += 1;
    },
    releaseLock: () => undefined,
  };
  const parsed = await readPreflightRequest({
    headers: new Headers(),
    body: { getReader: () => reader } as never,
    text: async () => {
      textCalls += 1;
      throw new Error('the bounded reader must not buffer via request.text()');
    },
  });

  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.status, 413);
    assert.equal(parsed.response.error?.code, 'PREFLIGHT_REQUEST_TOO_LARGE');
  }
  assert.equal(textCalls, 0);
  assert.equal(cancelCalls, 1);
  assert.ok(chunksRead < totalChunks);
});

test('preflight body reader rejects malformed JSON without reflecting it', async () => {
  const { readPreflightRequest } = await loadBoundary();
  const secret = 'data:image/png;base64,c2VjcmV0';
  const parsed = await readPreflightRequest({
    headers: new Headers(),
    text: async () => `{${secret}`,
  });
  assert.equal(parsed.ok, false);
  if (!parsed.ok) {
    assert.equal(parsed.status, 400);
    assert.equal(parsed.response.error?.code, 'PREFLIGHT_REQUEST_INVALID');
  }
  assert.doesNotMatch(JSON.stringify(parsed), /c2VjcmV0/);
});

test('runtime preflight route rejects inline data before any upload, asset record, or media write path', async () => {
  let uploadImageToStorageCalls = 0;
  let recordUserAssetCalls = 0;
  let mediaWriteCalls = 0;
  let authCalls = 0;
  const handler = createPreflightPostHandler({
    resolveMediaAwarePreflightFn: async () => {
      uploadImageToStorageCalls += 1;
      recordUserAssetCalls += 1;
      mediaWriteCalls += 1;
      return { ok: true };
    },
    getRouteAuthContextFn: async () => {
      authCalls += 1;
      return { userId: 'pricing-user' } as never;
    },
  });
  const body = {
    ...validBody(),
    inputs: [{
      ...validBody().inputs[0],
      dataUrl: 'data:image/png;base64,c2VjcmV0',
      durationSec: 99,
      width: 1920,
    }],
  };
  const response = await handler(new NextRequest('https://maxvideoai.com/api/preflight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));

  assert.equal(response.status, 400);
  assert.equal(uploadImageToStorageCalls, 0);
  assert.equal(recordUserAssetCalls, 0);
  assert.equal(mediaWriteCalls, 0);
  assert.equal(authCalls, 0);
  const payload = await response.json();
  assert.equal(payload.error?.code, 'PREFLIGHT_REQUEST_INVALID');
  assert.doesNotMatch(JSON.stringify(payload), /c2VjcmV0|reference\.png/);
});

test('runtime preflight route forwards only an allowed persisted-reference projection', async () => {
  let receivedRequest: unknown;
  const handler = createPreflightPostHandler({
    resolveMediaAwarePreflightFn: async (input) => {
      receivedRequest = input.request;
      return { ok: true, total: 42 };
    },
  });
  const response = await handler(new NextRequest('https://maxvideoai.com/api/preflight', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(validBody()),
  }));
  assert.equal(response.status, 200);
  assert.deepEqual((receivedRequest as { inputs?: unknown }).inputs, validBody().inputs);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
});

test('preflight read-only architecture cannot import generation attachment mutation sinks', async () => {
  const sources = await Promise.all([
    readFile(new URL('../frontend/app/api/preflight/route.ts', import.meta.url), 'utf8'),
    readFile(new URL('../frontend/app/api/preflight/_lib/preflight-handler.ts', import.meta.url), 'utf8'),
    readFile(new URL('../frontend/app/api/preflight/_lib/media-aware-preflight.ts', import.meta.url), 'utf8'),
  ]);
  const source = sources.join('\n');
  assert.match(source, /validateNormalizedGenerationAttachments/);
  assert.doesNotMatch(
    source,
    /processGenerationAttachments|processAndValidateGenerationAttachments|uploadImageToStorage|recordUserAsset/,
  );
});
