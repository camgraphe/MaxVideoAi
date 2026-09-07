import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';

test('authenticated status calls coalesce only within the same principal and release after completion', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://maxvideoai-test.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test-anon-key';
  const dom = new JSDOM('<div/>', { url: 'http://localhost/app' });
  const previous = new Map<string, PropertyDescriptor | undefined>();
  const requests: Array<{ resolve: (response: Response) => void }> = [];
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, navigator: dom.window.navigator, CustomEvent: dom.window.CustomEvent, BroadcastChannel: undefined,
    fetch: (input: string) => {
      assert.match(input, /^\/api\/jobs\//, 'all requests remain within mocked local status route');
      return new Promise<Response>((resolve) => requests.push({ resolve }));
    },
  })) {
    previous.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const { getJobStatus } = await import('../frontend/lib/api-job-status');
  const waitForRequests = async (count: number) => {
    for (let i = 0; requests.length < count && i < 100; i++) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(requests.length, count);
  };
  try {
    dom.window.sessionStorage.setItem('last-known:user-id', 'fixture-user-1');
    const first = getJobStatus('job_fixture');
    const duplicate = getJobStatus('job_fixture');
    assert.equal(first, duplicate);
    await waitForRequests(1);
    dom.window.sessionStorage.setItem('last-known:user-id', 'fixture-user-2');
    const anotherPrincipal = getJobStatus('job_fixture');
    assert.notEqual(first, anotherPrincipal);
    await waitForRequests(2);
    requests[0].resolve(new Response(JSON.stringify({ ok: true, jobId: 'job_fixture', status: 'running', observation: { stage: 'processing', providerPercent: { value: 0, provider: 'fal', source: 'provider' } } })));
    requests[1].resolve(new Response(JSON.stringify({ ok: true, jobId: 'job_fixture', status: 'running', observation: { stage: 'processing', degraded: true } })));
    const [firstResult, degraded] = await Promise.all([first, anotherPrincipal]);
    assert.equal(firstResult.observation?.providerPercent?.value, 0);
    assert.ok(firstResult.observation?.checkedAt);
    assert.equal(degraded.observation?.checkedAt, undefined);
    const next = getJobStatus('job_fixture');
    await waitForRequests(3);
    requests[2].resolve(new Response(JSON.stringify({ ok: true, jobId: 'job_fixture', status: 'completed', videoUrl: '/fixture.mp4' })));
    assert.equal((await next).status, 'completed');
  } finally {
    dom.window.close();
    for (const [key, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key);
    }
  }
});
