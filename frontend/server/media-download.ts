import { openPublicHttpsResponse } from '@/server/public-media-transport';

const MAX_DOWNLOAD_BYTES = 1024 ** 3;
const DOWNLOAD_TIMEOUT_MS = 120_000;

/** Stream exact original bytes without buffering the whole video in server memory. */
export async function downloadMediaStream(url: string, requestSignal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort(requestSignal.reason);
  requestSignal.addEventListener('abort', abort, { once: true });
  if (requestSignal.aborted) abort();
  const timeout = setTimeout(() => controller.abort(new Error('Download timed out')), DOWNLOAD_TIMEOUT_MS);
  const cleanup = () => { clearTimeout(timeout); requestSignal.removeEventListener('abort', abort); };
  try {
    const response = await openPublicHttpsResponse(url, undefined, { signal: controller.signal, timeoutMs: DOWNLOAD_TIMEOUT_MS });
    const header = (name: string) => {
      const value = response.headers[name];
      return Array.isArray(value) ? value[0] : value;
    };
    const declared = header('content-length');
    if (response.statusCode !== 200 || (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > MAX_DOWNLOAD_BYTES))) {
      response.cancel?.();
      throw new Error('Download unavailable or too large');
    }
    const iterator = response.body[Symbol.asyncIterator]();
    let total = 0;
    let closed = false;
    const finish = () => {
      if (closed) return;
      closed = true;
      response.cancel?.();
      cleanup();
      controller.signal.removeEventListener('abort', abortStream);
    };
    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const abortStream = () => { finish(); streamController.error(controller.signal.reason); };
    const body = new ReadableStream<Uint8Array>({
      start(value) {
        streamController = value;
        controller.signal.addEventListener('abort', abortStream, { once: true });
        if (controller.signal.aborted) abortStream();
      },
      async pull(value) {
        try {
          const chunk = await iterator.next();
          if (closed) return;
          if (chunk.done) {
            if (declared !== undefined && total !== Number(declared)) throw new Error('Incomplete download');
            finish(); value.close(); return;
          }
          total += chunk.value.byteLength;
          if (total > MAX_DOWNLOAD_BYTES || (declared !== undefined && total > Number(declared))) throw new Error('Download exceeds size limit');
          value.enqueue(chunk.value);
        } catch (error) { if (!closed) { finish(); value.error(error); } }
      },
      cancel() { finish(); controller.abort(); },
    });
    return {
      body,
      contentType: header('content-type') ?? 'application/octet-stream',
      contentLength: declared,
      contentEncoding: header('content-encoding'),
    };
  } catch (error) { cleanup(); controller.abort(); throw error; }
}
