import { toolAssetRefSchema, type ToolAssetRef, type ToolResult } from './contract';
import type { UpscaleToolResponse } from '@/types/tools-upscale';
import type { BackgroundRemovalToolResponse } from '@/types/tools-background-removal';

/** Additive result bridge: never derive an output ID or replace the exact stored original URL. */
export function normalizeQuickToolResult(toolId: 'upscale' | 'background-removal', sourceAssets: ToolAssetRef[], response: UpscaleToolResponse | BackgroundRemovalToolResponse): ToolResult | null {
  const output = response.output;
  if (!response.ok || !response.jobId || !output?.assetId || !output.url) return null;
  const kind = toolId === 'background-removal' ? 'video' : (response as UpscaleToolResponse).mediaType;
  const sources = sourceAssets.map(ref => toolAssetRefSchema.parse(ref));
  if (sources.length !== 1 || sources[0].kind !== kind) throw new Error('Result lineage does not match the tool input.');
  const asset = toolAssetRefSchema.parse({ type: 'asset', assetId: output.assetId, kind });
  return { toolId, version: 1, jobId: response.jobId, sourceAssets: sources, outputs: [{ asset, kind, originalUrl: output.url, thumbnailUrl: output.thumbUrl ?? null }] };
}
