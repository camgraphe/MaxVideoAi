import type { NextRequest } from 'next/server';
import { MAX_MARKETING_IMPORT_BODY_BYTES, type MarketingImportPreview } from '@/lib/marketing-media';
import { requireAdmin } from '@/server/admin';
import { marketingApiError, marketingJson } from '@/server/marketing-media/api';
import { importMarketingPublication, previewMarketingPublicationImport } from '@/server/marketing-media/import-publication';
import { revalidateMarketingPublication } from '@/server/marketing-media/revalidate';
import { MarketingMediaError } from '@/server/marketing-media/snapshot';
import { marketingMediaEnabled } from '@/server/marketing-media/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 240;

async function readImportRequest(req: Request): Promise<{ manifest: unknown; permissionConfirmed?: unknown }> {
  const tooLarge = () => new MarketingMediaError('The import request must be at most 2 MiB.', 413);
  if (Number(req.headers.get('Content-Length')) > MAX_MARKETING_IMPORT_BODY_BYTES) throw tooLarge();
  if (req.headers.get('Content-Type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    throw new MarketingMediaError('Send the publication manifest as application/json.', 415);
  }
  if (!req.body) throw new MarketingMediaError('Choose a JSON publication manifest.');

  // Content-Length is only an early rejection hint. Enforce the cap on the actual stream.
  const reader = req.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0;
  let text = '';
  let payload: unknown;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_MARKETING_IMPORT_BODY_BYTES) throw tooLarge();
      text += decoder.decode(value, { stream: true });
    }
    payload = JSON.parse(text + decoder.decode());
  } catch (error) {
    void reader.cancel().catch(() => undefined);
    if (error instanceof MarketingMediaError) throw error;
    throw new MarketingMediaError('Choose a valid JSON publication manifest.');
  } finally {
    reader.releaseLock();
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) || !Object.hasOwn(payload, 'manifest')) {
    throw new MarketingMediaError('Choose a JSON publication manifest.');
  }
  return payload as { manifest: unknown; permissionConfirmed?: unknown };
}

export async function POST(req: NextRequest) {
  try {
    const actorId = await requireAdmin(req);
    if (!marketingMediaEnabled()) {
      return marketingJson({ ok: false, error: 'Marketing media activation is pending.' }, 503);
    }
    const previewMode = new URL(req.url).searchParams.get('preview');
    if (previewMode !== null && previewMode !== '1') throw new MarketingMediaError('Invalid preview mode.');
    const { manifest, permissionConfirmed } = await readImportRequest(req);
    if (previewMode === '1') {
      const preview: MarketingImportPreview = previewMarketingPublicationImport(manifest);
      return marketingJson({ ok: true, preview });
    }
    if (permissionConfirmed !== true) {
      throw new MarketingMediaError('Confirm permission to copy the public video and all of its references.', 403);
    }
    const item = await importMarketingPublication({ manifest, actorId, permissionConfirmed });
    await revalidateMarketingPublication(item.videoId);
    return marketingJson({ ok: true, item });
  } catch (error) {
    return marketingApiError(error);
  }
}
