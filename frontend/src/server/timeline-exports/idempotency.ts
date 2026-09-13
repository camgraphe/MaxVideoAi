import { z } from 'zod';

// Transport and service accept the same exact key. Do not trim or truncate it:
// punctuation and the complete suffix are part of the caller's request identity.
export const timelineExportIdempotencyKeySchema = z.string().min(8).max(200).regex(/^[a-zA-Z0-9._:-]+$/);

export function assertTimelineExportIdempotencyKey(value: unknown): asserts value is string {
  if (!timelineExportIdempotencyKeySchema.safeParse(value).success) throw new Error('INVALID_EXPORT_IDEMPOTENCY_KEY');
}
