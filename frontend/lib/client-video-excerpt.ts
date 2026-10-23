import type { UploadedVideoAsset } from '@/lib/client-video-upload';
import type { ToolAssetRef } from '@/lib/toolbox/contract';
import type { VideoExcerptRange } from '@/lib/video-excerpt';
import type { VideoSourceWorkflow } from '@/lib/video-source-workflow';

export async function requestVideoExcerpt(
  input: { source: ToolAssetRef; engineId: string; mode: VideoSourceWorkflow; range: VideoExcerptRange },
  request: typeof fetch
) {
  const response = await request('/api/uploads/video/excerpt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.ok)
    throw new Error(result?.error?.message ?? 'Unable to prepare the excerpt. Try again.');
  const asset = result.asset as UploadedVideoAsset;
  if (!asset?.id || !asset.url || !Number.isFinite(asset.durationSec) || asset.durationSec! <= 0)
    throw new Error('The prepared video could not be verified. Try again.');
  return { asset };
}
