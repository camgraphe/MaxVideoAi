export type PublicMediaExpectation = {
  bytes: number;
  mime: string;
  prefix?: Uint8Array;
  suffix?: Uint8Array;
};

async function readExactRangeBody(response: Response, expectedBytes: number): Promise<Buffer> {
  if (!response.body) throw new Error('Public media Range response has no body');
  const reader = response.body.getReader();
  const output = Buffer.alloc(expectedBytes);
  let offset = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (offset + chunk.value.byteLength > expectedBytes)
        throw new Error(`Public media Range body exceeds ${expectedBytes} bytes`);
      output.set(chunk.value, offset);
      offset += chunk.value.byteLength;
    }
    if (offset !== expectedBytes) throw new Error('Public media Range body has invalid length');
    return output;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

/** Verify an already-authorized storage/manifest URL, never an arbitrary user URL.
 * Bounded GETs test real delivery and seeking without downloading the file again. */
export async function verifyPublicMediaHttp(
  url: string,
  expected: PublicMediaExpectation,
  dependencies: { fetchFn?: typeof fetch; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<Buffer> {
  if (!Number.isSafeInteger(expected.bytes) || expected.bytes < 1) throw new Error('Invalid public media size');
  const fetchFn = dependencies.fetchFn ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.min(dependencies.timeoutMs ?? 15_000, 120_000));
  const signal = dependencies.signal ? AbortSignal.any([dependencies.signal, controller.signal]) : controller.signal;
  const mime = (response: Response) => response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  try {
    signal.throwIfAborted();
    const head = await fetchFn(url, { method: 'HEAD', cache: 'no-store', redirect: 'error', signal });
    if (!head.ok) throw new Error(`Public media HEAD failed with ${head.status}`);
    if (mime(head) !== expected.mime) throw new Error(`Public media must be ${expected.mime}`);
    if (Number(head.headers.get('content-length')) !== expected.bytes)
      throw new Error('Public media content length differs from manifest');
    const length = Math.min(32, expected.bytes);
    async function range(start: number, sample?: Uint8Array) {
      const end = start + length - 1;
      const response = await fetchFn(url, {
        method: 'GET', headers: { Range: `bytes=${start}-${end}`, 'Accept-Encoding': 'identity' },
        cache: 'no-store', redirect: 'error', signal,
      });
      try {
        if (response.status !== 206) throw new Error('Public media must support Range requests');
        if (mime(response) !== expected.mime) throw new Error(`Public media Range response must be ${expected.mime}`);
        if (response.headers.get('content-range') !== `bytes ${start}-${end}/${expected.bytes}`)
          throw new Error('Public media returned an invalid Content-Range');
        if (Number(response.headers.get('content-length')) !== length)
          throw new Error('Public media Range response has invalid length');
        const body = await readExactRangeBody(response, length);
        if (sample && !body.equals(sample)) throw new Error('Public media bytes differ from the copied source');
        return body;
      } finally {
        if (!response.body?.locked) await response.body?.cancel().catch(() => undefined);
      }
    }
    const prefix = await range(0, expected.prefix);
    if (expected.suffix && expected.bytes > length) await range(expected.bytes - length, expected.suffix);
    return prefix;
  } finally {
    clearTimeout(timer);
  }
}
