import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { adminErrorToResponse, requireAdmin } from '@/server/admin';
import { PricingAdminError } from '../errors';
import { TARIFF_BATCH_MAX_BYTES } from './contract';
import { batchInvalid, batchRecord, batchUuid, exactFields } from './input';

function json(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } }); }
class BatchHttpError extends Error { constructor(readonly status: number, message: string) { super(message); } }
async function body(req: NextRequest): Promise<unknown> {
  if (req.headers.get('origin') !== new URL(req.url).origin) throw new BatchHttpError(403, 'A same-origin admin request is required.');
  if (req.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') batchInvalid('Expected JSON.');
  if (Number(req.headers.get('content-length')) > TARIFF_BATCH_MAX_BYTES) throw new BatchHttpError(413, 'Batch request is too large.');
  const reader = req.body?.getReader();
  if (!reader) batchInvalid('Missing batch request.');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break;
      size += next.value.byteLength;
      if (size > TARIFF_BATCH_MAX_BYTES) { await reader.cancel(); throw new BatchHttpError(413, 'Batch request is too large.'); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { return batchInvalid('Invalid JSON batch request.'); }
}
export function batchCommand(value: unknown, confirm = false) {
  const record = batchRecord(value);
  exactFields(record, confirm ? ['operationId', 'fingerprint'] : ['operationId']);
  const operationId = batchUuid(record.operationId);
  if (confirm && (typeof record.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(record.fingerprint))) batchInvalid('Invalid preview fingerprint.');
  return { operationId, fingerprint: typeof record.fingerprint === 'string' ? record.fingerprint : '' };
}
export async function tariffBatchHttp(req: NextRequest, mutate: boolean,
  action: (actorId: string, payload: unknown) => Promise<unknown>) {
  let actorId: string;
  try { actorId = await requireAdmin(req); }
  catch (error) { const response = adminErrorToResponse(error); response.headers.set('Cache-Control', 'no-store'); return response; }
  try { return json({ ok: true, ...(await action(actorId, mutate ? await body(req) : null) as object) }); }
  catch (error) {
    if (error instanceof PricingAdminError) return json({ ok: false, error: error.code, message: error.message }, error.status);
    if (error instanceof BatchHttpError) return json({ ok: false, error: 'invalid_request', message: error.message }, error.status);
    return json({ ok: false, error: 'database_unavailable', message: 'Batch status is unavailable. Keep the operation ID and check its status before any new confirmation.' }, 503);
  }
}
