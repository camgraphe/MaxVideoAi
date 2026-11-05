import { createHash } from 'node:crypto';
import { z } from 'zod';
import { importDigest, type ExternalFalImport } from './contract';

const file = z.object({ utf8: z.string().min(1).max(2 * 1024 * 1024), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const schema = z.object({ format: z.literal('maxvideoai-recorded-fal-files-v1'), assembledAt: z.string().datetime(),
  files: z.object({ request: file, receipt: file, submission: file, status: file, result: file }).strict(),
}).strict();

/** A later envelope of original separate files, never a manufactured contemporaneous event log.
 * The enclosing manifest hashes this envelope; each original UTF-8 file stays byte-identical.
 * Live bound GETs and durable media verification remain mandatory in the evidence owner. */
export function readExternalFalRecordedFiles(input: Pick<ExternalFalImport,
  'engineId' | 'endpoint' | 'mode' | 'providerRequestId' | 'providerInput' | 'videoSha256'>, serialized: string): string | null {
  let candidate: unknown;
  try { candidate = JSON.parse(serialized); } catch { return null; }
  if (!candidate || typeof candidate !== 'object' || !('format' in candidate)
    || candidate.format !== 'maxvideoai-recorded-fal-files-v1') return null;
  if (input.engineId !== 'kling-v4-flash') throw new Error('IMPORT_RECORDED_FILES_ENGINE');
  const bundle = schema.parse(candidate);
  const parsed = Object.fromEntries(Object.entries(bundle.files).map(([name, record]) => {
    if (createHash('sha256').update(record.utf8).digest('hex') !== record.sha256) throw new Error('IMPORT_RECORDED_FILE_HASH');
    const data: unknown = JSON.parse(record.utf8);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('IMPORT_RECORDED_FILE_OBJECT');
    return [name, data];
  })) as Record<keyof typeof bundle.files, Record<string, unknown>>;
  const { request, receipt, submission, status, result } = parsed;
  const resultUrl = `https://queue.fal.run/kling/v4/requests/${input.providerRequestId}`;
  const started = Date.parse(String(receipt.startedAt)), completed = Date.parse(String(receipt.completedAt));
  if (typeof request.id !== 'string' || !request.id || request.id !== receipt.id
    || request.model !== input.endpoint || receipt.model !== input.endpoint || receipt.mode !== input.mode
    || importDigest(request.payload) !== importDigest(input.providerInput)
    || receipt.attempts !== 1 || receipt.status !== 'completed' || receipt.requestId !== input.providerRequestId
    || receipt.sha256 !== input.videoSha256 || receipt.responseUrl !== resultUrl || receipt.statusUrl !== resultUrl + '/status'
    || !Number.isFinite(started) || !Number.isFinite(completed) || completed < started || Date.parse(bundle.assembledAt) < completed
    || submission.request_id !== input.providerRequestId || submission.response_url !== resultUrl || submission.status_url !== resultUrl + '/status'
    || status.status !== 'COMPLETED' || status.request_id !== input.providerRequestId
    || status.response_url !== resultUrl || status.status_url !== resultUrl + '/status') {
    throw new Error('IMPORT_RECORDED_FILES_BINDING');
  }
  return importDigest(result);
}
