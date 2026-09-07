import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import test from 'node:test';

function body(...chunks: string[]): AsyncIterable<Uint8Array> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) yield Buffer.from(chunk);
    },
  };
}

test('pinned HTTPS adapter uses runtime-compatible lookup shapes and bracketless TLS hostnames', async () => {
  const module = await import('../frontend/server/media-library/asset-media');
  const requestPinned = Reflect.get(module, 'requestPinnedHttpsWithDependencies');
  assert.equal(typeof requestPinned, 'function', 'pinned HTTPS needs an injected request adapter boundary');

  for (const fixture of [
    {
      url: new URL('https://provider.example/output.png'),
      address: '93.184.216.34',
      family: 4,
      hostname: 'provider.example',
      servername: 'provider.example',
    },
    {
      url: new URL('https://93.184.216.34/output.png'),
      address: '93.184.216.34',
      family: 4,
      hostname: '93.184.216.34',
      servername: undefined,
    },
    {
      url: new URL('https://[2606:4700:4700::1111]/output.png'),
      address: '2606:4700:4700::1111',
      family: 6,
      hostname: '2606:4700:4700::1111',
      servername: undefined,
    },
  ] as const) {
    let reachedRequestLayer = 0;
    const response = await requestPinned({
      url: fixture.url,
      address: fixture.address,
      family: fixture.family,
      signal: new AbortController().signal,
    }, {
      request: (options: Record<string, unknown>, onResponse: (response: Readable) => void) => {
        reachedRequestLayer += 1;
        assert.equal(options.hostname, fixture.hostname);
        assert.equal(options.servername, fixture.servername);
        const lookup = options.lookup as (
          hostname: string,
          options: { all?: boolean },
          callback: (error: Error | null, address: unknown, family?: number) => void
        ) => void;
        lookup(fixture.hostname, { all: true }, (error, addresses) => {
          assert.equal(error, null);
          assert.deepEqual(addresses, [{ address: fixture.address, family: fixture.family }]);
        });
        lookup(fixture.hostname, { all: false }, (error, address, family) => {
          assert.equal(error, null);
          assert.equal(address, fixture.address);
          assert.equal(family, fixture.family);
        });

        const request = new EventEmitter() as EventEmitter & {
          end: () => void;
          destroy: (error?: Error) => void;
        };
        request.end = () => {
          const stream = Readable.from(['image']) as Readable & {
            statusCode: number;
            headers: Record<string, string>;
          };
          stream.statusCode = 200;
          stream.headers = { 'content-type': 'image/png' };
          onResponse(stream);
        };
        request.destroy = (error) => {
          if (error) request.emit('error', error);
        };
        return request;
      },
    });
    assert.equal(response.status, 200);
    assert.equal(reachedRequestLayer, 1);
  }
});

test('IPv4 policy matches IANA global reachability through direct and embedded forms', async () => {
  const module = await import('../frontend/server/media-library/asset-media');
  const download = Reflect.get(module, 'downloadRemoteMediaWithDependencies');
  assert.equal(typeof download, 'function');

  for (const fixture of [
    { address: '240.0.0.1', family: 4 },
    { address: '255.255.255.255', family: 4 },
    { address: '192.88.99.1', family: 4 },
    { address: '192.88.99.2', family: 4 },
    { address: '::ffff:f000:1', family: 6 },
    { address: '::ffff:c058:6302', family: 6 },
    { address: '64:ff9b::f000:1', family: 6 },
    { address: '64:ff9b::c058:6301', family: 6 },
    { address: '64:ff9b::c058:6302', family: 6 },
  ] as const) {
    let requests = 0;
    await assert.rejects(() => download({
      url: 'https://provider.example/output.png',
      kind: 'image',
    }, {
      lookup: async () => [fixture],
      request: async () => {
        requests += 1;
        return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
      },
    }), /REMOTE_MEDIA_ADDRESS_NOT_ALLOWED/);
    assert.equal(requests, 0, `${fixture.address} must be denied before request I/O`);
  }

  for (const fixture of [
    { address: '8.8.8.8', family: 4 },
    { address: '192.0.0.9', family: 4 },
    { address: '192.0.0.10', family: 4 },
    { address: '::ffff:808:808', family: 6 },
    { address: '64:ff9b::808:808', family: 6 },
  ] as const) {
    let requests = 0;
    const result = await download({
      url: 'https://provider.example/output.png',
      kind: 'image',
    }, {
      lookup: async () => [fixture],
      request: async () => {
        requests += 1;
        return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
      },
    });
    assert.equal(requests, 1, `${fixture.address} must remain explicitly allowed`);
    assert.equal(result.data.toString(), 'image');
  }
});

test('IPv6 policy rejects non-global space and treats NAT64 by embedded IPv4 policy', async () => {
  const module = await import('../frontend/server/media-library/asset-media');
  const download = Reflect.get(module, 'downloadRemoteMediaWithDependencies');
  assert.equal(typeof download, 'function');

  for (const address of [
    '5f00::1',
    '3fff::1',
    '2001:db8::1',
    '64:ff9b::a00:1',
    '64:ff9b::7f00:1',
    '64:ff9b::c000:201',
  ]) {
    let requests = 0;
    await assert.rejects(() => download({
      url: 'https://provider.example/output.png',
      kind: 'image',
    }, {
      lookup: async () => [{ address, family: 6 }],
      request: async () => {
        requests += 1;
        return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
      },
    }), /REMOTE_MEDIA_ADDRESS_NOT_ALLOWED/);
    assert.equal(requests, 0, `${address} must be denied before request I/O`);
  }

  for (const address of ['2606:4700:4700::1111', '2a00:1450:4009:80b::200e', '64:ff9b::808:808']) {
    let requests = 0;
    const result = await download({
      url: 'https://provider.example/output.png',
      kind: 'image',
    }, {
      lookup: async () => [{ address, family: 6 }],
      request: async () => {
        requests += 1;
        return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
      },
    });
    assert.equal(requests, 1, `${address} must remain explicitly allowed`);
    assert.equal(result.data.toString(), 'image');
  }
});

test('IPv6 policy matches IANA globally reachable 2001::/23 allocations and denies surrounding space', async () => {
  const module = await import('../frontend/server/media-library/asset-media');
  const download = Reflect.get(module, 'downloadRemoteMediaWithDependencies');

  for (const address of ['2001:1::4', '2001:2::1', '2001:4:111::1', '2001:4:113::1', '2001:10::1', '2001:40::1']) {
    let requests = 0;
    await assert.rejects(() => download({
      url: 'https://provider.example/output.png',
      kind: 'image',
    }, {
      lookup: async () => [{ address, family: 6 }],
      request: async () => {
        requests += 1;
        return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
      },
    }), /REMOTE_MEDIA_ADDRESS_NOT_ALLOWED/);
    assert.equal(requests, 0, `${address} must be denied before request I/O`);
  }

  for (const address of [
    '2001:1::1',
    '2001:1::2',
    '2001:1::3',
    '2001:3::1',
    '2001:4:112::1',
    '2001:20::1',
    '2001:30::1',
  ]) {
    let requests = 0;
    const result = await download({
      url: 'https://provider.example/output.png',
      kind: 'image',
    }, {
      lookup: async () => [{ address, family: 6 }],
      request: async () => {
        requests += 1;
        return { status: 200, headers: new Headers({ 'content-type': 'image/png' }), body: body('image') };
      },
    });
    assert.equal(requests, 1, `${address} must remain explicitly allowed`);
    assert.equal(result.data.toString(), 'image');
  }
});
