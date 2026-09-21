import { NextRequest, NextResponse } from 'next/server';
import { authorizeEditorialIngest } from './ingest';
import { uploadEditorialDraftMedia } from './media-storage';
import { EDITORIAL_MEDIA_MAX_BYTES } from './media-upload';

type Dependencies = {
  token: () => string | null;
  privateStorage: () => boolean;
  store: typeof uploadEditorialDraftMedia;
  maxBytes: number;
};

/** Draft-only mode of the existing image upload route. Never falls back to user auth. */
export function createEditorialImageUploadHandler(overrides: Partial<Dependencies> = {}) {
  const deps: Dependencies = {
    token: () => process.env.EDITORIAL_INGEST_TOKEN ?? null,
    privateStorage: () => process.env.EDITORIAL_DRAFT_MEDIA_PRIVATE_CONFIRMED === '1',
    store: uploadEditorialDraftMedia,
    maxBytes: EDITORIAL_MEDIA_MAX_BYTES,
    ...overrides,
  };
  return async (request: NextRequest) => {
    if (!authorizeEditorialIngest(request.headers.get('authorization'), deps.token())) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!deps.privateStorage()) {
      return NextResponse.json({ ok: false, error: 'Private draft storage policy required' }, { status: 503 });
    }
    const hash = request.headers.get('x-content-sha256');
    if (!hash || !/^[a-f0-9]{64}$/.test(hash)) return NextResponse.json({ ok: false, error: 'Image hash required' }, { status: 400 });
    const tooLarge = () => NextResponse.json({ ok: false, error: 'Image too large' }, { status: 413 });
    if (Number(request.headers.get('content-length')) > deps.maxBytes) return tooLarge();
    if (!request.body) return NextResponse.json({ ok: false, error: 'Image required' }, { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    const reader = request.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > deps.maxBytes) { await reader.cancel(); return tooLarge(); }
        chunks.push(value);
      }
      const asset = await deps.store(Buffer.concat(chunks), request.headers.get('content-type') ?? '', hash);
      return NextResponse.json({ ok: true, asset }, { status: 201 });
    } catch {
      return NextResponse.json({ ok: false, error: 'Image rejected; inspect image integrity and private storage policy' }, { status: 422 });
    } finally {
      reader.releaseLock();
    }
  };
}
