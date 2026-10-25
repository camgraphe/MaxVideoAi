import { isH3SourceOperation } from '@/lib/h3-source-operations';
import { inspectOwnedH3Source } from '@/server/video-excerpts/h3-relight';
import type { ResolvedReference } from './reference-types';

/** One persisted comparison shape: never spread probe-only codec/stream fields into receipts. */
export async function qualifyH3SourceReference(reference: ResolvedReference, operation: unknown, userId: string, inspect = inspectOwnedH3Source): Promise<ResolvedReference> {
  if (!isH3SourceOperation(operation) || reference.role !== 'source' || reference.mediaKind !== 'video') return reference;
  const measured = await inspect(reference.storageUrl, operation, userId);
  return {...reference, width:measured.width, height:measured.height, durationSec:measured.durationSec,
    sizeBytes:measured.sizeBytes, mimeType:measured.mimeType, fps:measured.fps,
    ...(measured.decodedFrameCount === undefined ? {} : {decodedFrameCount:measured.decodedFrameCount}),
    ...(measured.constantFrameRate === undefined ? {} : {constantFrameRate:measured.constantFrameRate}),
    sourceSha256:measured.sourceSha256};
}
