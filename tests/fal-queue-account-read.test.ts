import assert from 'node:assert/strict';
import test from 'node:test';
import { createFalQueueReadFetch } from '../frontend/src/lib/fal-queue-fetch';

const requestUrl = 'https://queue.fal.run/kling/v4/requests/test-request';
const credentials = { primary: 'direct', fallback: 'marketplace' };

function observeFetch(responses: Response[]) {
  const requests: Request[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    requests.push(new Request(input, init));
    const response = responses.shift();
    assert.ok(response, 'Unexpected provider request');
    return response;
  };
  return { requests, fetcher };
}

test('a missing Fal status or result is read with the other account for the same request', async () => {
  for (const suffix of ['', '/status?logs=0']) {
    const expected = new Response('{"request_id":"test-request"}');
    const { fetcher, requests } = observeFetch([new Response(null, { status: 404 }), expected]);
    const read = createFalQueueReadFetch(fetcher, credentials);
    const input = new Request(requestUrl + suffix, { headers: { Authorization: 'Key direct', 'X-Trace': 'example' } });
    assert.equal(await read(input), expected);
    assert.deepEqual(requests.map((request) => request.headers.get('Authorization')), ['Key direct', 'Key marketplace']);
    assert.ok(requests.every((request) => request.url === input.url && request.method === 'GET'));
    assert.equal(requests[1].redirect, 'error');
    assert.equal(requests[1].headers.get('X-Trace'), 'example');
  }
});

test('Fal account fallback is limited to missing authenticated queue reads', async () => {
  for (const { url, status, method, authorization } of [
    { url: requestUrl, status: 200, method: 'GET', authorization: 'Key direct' },
    { url: requestUrl, status: 403, method: 'GET', authorization: 'Key direct' },
    { url: requestUrl, status: 404, method: 'POST', authorization: 'Key direct' },
    { url: requestUrl + '/cancel', status: 404, method: 'PUT', authorization: 'Key direct' },
    { url: requestUrl, status: 404, method: 'GET', authorization: 'Key other' },
    { url: requestUrl.replace('queue.fal.run', 'queue.fal.run.example.com'), status: 404, method: 'GET', authorization: 'Key direct' },
  ]) {
    const expected = new Response(null, { status });
    const { fetcher, requests } = observeFetch([expected]);
    const read = createFalQueueReadFetch(fetcher, credentials);
    assert.equal(await read(url, { method, headers: { Authorization: authorization } }), expected);
    assert.equal(requests.length, 1);
  }
});
