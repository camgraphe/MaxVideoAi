import { canonicalMediaAssetFields } from '@/lib/media-identity';
import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';

/** An explicit image identity must agree with its known originating job. URLs are never identity. */
export function storyboardImageRef(value: unknown, jobId?: string | null): ToolAssetRef | undefined {
  const parsed = toolAssetRefSchema.safeParse(value);
  if (!parsed.success || parsed.data.kind !== 'image') return undefined;
  if (parsed.data.type === 'asset') return canonicalMediaAssetFields(parsed.data.assetId, 'image').ref;
  return !jobId || parsed.data.jobId === jobId ? parsed.data : undefined;
}
