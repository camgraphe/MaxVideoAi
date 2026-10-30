import assert from 'node:assert/strict';
import test from 'node:test';
import { requestHostedWalletCheckout } from '../frontend/lib/wallet/hosted-checkout';

const input = { accessToken: 'synthetic', amountCents: 1000, currency: 'EUR', locale: 'en' };
const networkFailure = { kind: 'failed', reason: 'network', checkoutAttemptId: null };
const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve(); };

for (const respectsSignal of [true, false]) {
  test(`hosted fetch deadline settles and aborts when injected fetch ${respectsSignal ? 'respects' : 'ignores'} signal`, async t => {
    t.mock.timers.enable({ apis: ['setTimeout'] });
    let result: unknown; let signal: AbortSignal | null | undefined; let calls = 0;
    let resolveRequest!: (response: Response) => void;
    const pending = requestHostedWalletCheckout(input, (_url, init) => new Promise<Response>((resolve, reject) => {
      calls++; signal = init?.signal; resolveRequest = resolve;
      if (respectsSignal) signal?.addEventListener('abort', () => reject(new Error('aborted')));
    })).then(value => { result = value; });
    try {
      t.mock.timers.tick(29_999); await flush(); assert.equal(result, undefined);
      t.mock.timers.tick(1); await flush(); assert.deepEqual(result, networkFailure);
      assert.equal(signal?.aborted, true); assert.equal(calls, 1, 'no automatic retry');
    } finally { resolveRequest(Response.json({ url: '#late' })); await pending; }
  });
}

test('one deadline covers the body after headers and ignores a late ready body', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let result: unknown; let signal: AbortSignal | null | undefined; let resolveBody!: (value: unknown) => void;
  let resolveHeaders!: (response: Response) => void;
  const pending = requestHostedWalletCheckout(input, (_url, init) => {
    signal = init?.signal;
    return new Promise<Response>(resolve => { resolveHeaders = resolve; });
  }).then(value => { result = value; });
  try {
    t.mock.timers.tick(20_000);
    resolveHeaders({ ok: true, status: 200, json: () => new Promise(resolve => { resolveBody = resolve; }) } as Response);
    await flush(); t.mock.timers.tick(10_000); await flush();
    assert.deepEqual(result, networkFailure); assert.equal(signal?.aborted, true);
    resolveBody({ id: 'cs_late', url: '#late' }); await flush(); assert.deepEqual(result, networkFailure);
  } finally { resolveBody?.({}); await pending; }
});

test('a completed preparation clears its timer and preserves ready/CAPTCHA/rate results', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const [response, expected] of [
    [Response.json({ url: '#ready', checkoutAttemptId: 4 }), { kind: 'ready', url: '#ready', sessionId: null, checkoutAttemptId: 4 }],
    [Response.json({ captchaRequired: true }, { status: 403 }), { kind: 'captcha_required' }],
    [Response.json({ retryAfterSeconds: 12 }, { status: 429 }), { kind: 'rate_limited', retryAfterSeconds: 12 }],
  ] as const) {
    let signal: AbortSignal | null | undefined;
    assert.deepEqual(await requestHostedWalletCheckout(input, async (_url, init) => { signal = init?.signal; return response; }), expected);
    t.mock.timers.tick(30_000); await flush();
    assert.equal(signal?.aborted, false, 'completed request has no live deadline');
  }
});

test('external retirement settles even a fetch that ignores abort and a pre-aborted attempt never posts', async () => {
  const controller = new AbortController(); let calls = 0;
  const fetchImpl = (() => { calls++; return new Promise<Response>(() => {}); }) as typeof fetch;
  const pending = requestHostedWalletCheckout(input, fetchImpl, controller.signal);
  controller.abort(); assert.deepEqual(await pending, networkFailure);
  assert.deepEqual(await requestHostedWalletCheckout(input, fetchImpl, controller.signal), networkFailure);
  assert.equal(calls, 1);
});
