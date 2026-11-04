import type { ToolAssetRef } from '@/lib/toolbox/contract';
import { storyboardImageRef } from '@/lib/storyboard-reference-identity';
export { storyboardImageRef } from '@/lib/storyboard-reference-identity';
import type { ReferenceAsset } from './workspace-assets';

const legacyStoryboardJob = /^storyboard_(?:kling_first_frame_)?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu;

/** A job ID is a lookup hint, never an owned media-asset identity. */
export function storyboardReferenceJobId(asset: ReferenceAsset): string | undefined {
  if (asset.kind !== 'image') return undefined;
  if (asset.storyboardJobId) return asset.storyboardJobId;
  return asset.assetId && legacyStoryboardJob.test(asset.assetId) ? asset.assetId : undefined;
}

/** Only the authenticated exact-job reader can recover a missing output identity. */
export function readStoryboardOutputRef(payload: unknown, jobId: string): ToolAssetRef | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const page = payload as { ok?: unknown; outputs?: unknown; hasMore?: unknown; nextCursor?: unknown };
  if (page.ok !== true || page.hasMore !== false || page.nextCursor != null
    || !Array.isArray(page.outputs) || page.outputs.length !== 1) return undefined;
  const output = page.outputs[0];
  if (!output || typeof output !== 'object') return undefined;
  const row = output as { id?: unknown; jobId?: unknown; kind?: unknown; status?: unknown; ref?: unknown };
  const ref = storyboardImageRef(row.ref, jobId);
  return row.jobId === jobId && row.kind === 'image' && row.status === 'ready'
    && ref?.type === 'job-output' && ref.jobId === jobId && ref.outputId === row.id ? ref : undefined;
}
