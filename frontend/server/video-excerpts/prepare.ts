import { createHash } from 'node:crypto';
import { z } from 'zod';
import { toolAssetRefSchema, type ToolAssetRef } from '@/lib/toolbox/contract';
import { canonicalMediaAssetFields } from '@/lib/media-identity';
import type { UploadedVideoAsset } from '@/lib/client-video-upload';
import { getVideoExcerptLimits, validateVideoExcerptRange, type VideoExcerptRange } from '@/lib/video-excerpt';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
import { getReadOnlyConfiguredEngine } from '@/server/agent-api/read-only-engine-catalog';
import { storeVideoUpload } from '@/server/uploads/store-media-upload';
import { downloadVideoExcerptMedia, inspectVideoExcerptBytes, trimVideoExcerptBytes, validateVideoExcerptOutput, validateStoredVideoExcerptFacts, withVideoExcerptSlot, VideoExcerptError, VIDEO_EXCERPT_PREPARATION_LIMITS, type VideoExcerptFacts } from './media';

export type PrepareVideoExcerptInput = { source: ToolAssetRef; engineId: string; mode: 'v2v' | 'extend' | 'reframe'; range: VideoExcerptRange };
const inputSchema = z.object({
  source: toolAssetRefSchema.refine(value => value.kind === 'video'), engineId: z.string().trim().min(1).max(128),
  mode: z.enum(['v2v','extend','reframe']),
  range: z.object({ startSec: z.number().finite().nonnegative(), endSec: z.number().finite().positive() }).strict(),
}).strict();

async function persistVideoExcerpt(userId: string, bytes: Buffer, facts: VideoExcerptFacts, lineage: Record<string, unknown>): Promise<UploadedVideoAsset> {
  const contentAddressedNamespace = `video-excerpt-v1-${createHash('sha256').update(JSON.stringify(lineage)).digest('hex')}`;
  const stored = await storeVideoUpload({ userId, bytes, fileName:'video-excerpt.mp4', declaredMime:'video/mp4', contentAddressedNamespace, metadata:{videoExcerpt:lineage} });
  validateStoredVideoExcerptFacts(facts,stored);
  return { id:stored.legacyAssetId, legacyAssetId:stored.legacyAssetId, ...canonicalMediaAssetFields(stored.assetId,'video'),
    url:stored.storageUrl, durationSec:stored.durationSec, mediaFacts:stored.mediaFacts, width:stored.width, height:stored.height,
    size:stored.sizeBytes, mime:stored.mimeType, name:'video-excerpt.mp4', thumbUrl:stored.previewUrl };
}
export type VideoExcerptDependencies = {
  engine: typeof getReadOnlyConfiguredEngine; resolve: typeof resolveStudioMedia;
  readAccess: typeof createConversationMediaReadAccess; download: typeof downloadVideoExcerptMedia;
  inspect: typeof inspectVideoExcerptBytes; trim: typeof trimVideoExcerptBytes; persist: typeof persistVideoExcerpt;
};
const defaults: VideoExcerptDependencies = {engine:getReadOnlyConfiguredEngine,resolve:resolveStudioMedia,readAccess:createConversationMediaReadAccess,download:downloadVideoExcerptMedia,inspect:inspectVideoExcerptBytes,trim:trimVideoExcerptBytes,persist:persistVideoExcerpt};
const fingerprint = (media: Awaited<ReturnType<typeof resolveStudioMedia>>) => createHash('sha256').update(JSON.stringify(media)).digest('hex');

/** Uncharged owned-media preparation. Normal generation and exact quoting consume the resulting asset. */
export async function prepareVideoExcerpt(userId: string, value: unknown, dependencies: Partial<VideoExcerptDependencies> = {}): Promise<{asset:UploadedVideoAsset;range:VideoExcerptRange;original:ToolAssetRef}> {
  if (!userId) throw new VideoExcerptError('AUTH_REQUIRED','Authenticate before preparing an excerpt.');
  const parsed = inputSchema.safeParse(value);
  if (!parsed.success || parsed.data.range.endSec <= parsed.data.range.startSec) throw new VideoExcerptError('PARAMETER_INVALID','Choose a video source, active model and valid start/end range.');
  const input = parsed.data, deps = {...defaults,...dependencies};
  return withVideoExcerptSlot(userId, async () => {
    try {
      const engine = await deps.engine(input.engineId), limits = engine && getVideoExcerptLimits(engine,input.mode);
      if (!limits) throw new VideoExcerptError('ENGINE_UNAVAILABLE','This source-video mode is unavailable. Choose another active model or mode.');
      if (input.range.endSec-input.range.startSec > VIDEO_EXCERPT_PREPARATION_LIMITS.maxExcerptSec) throw new VideoExcerptError('PREPARATION_LIMIT','Choose an excerpt of at most 60 seconds. The full-video workflow remains available.');
      const original = await deps.resolve(userId,input.source), snapshot = fingerprint(original);
      const access = await deps.readAccess(userId,original);
      const downloaded = await deps.download({file_id:original.id, download_url:access.url, mime_type:original.mime});
      const sourceFacts = await deps.inspect(downloaded.bytes,downloaded.mimeType);
      let range: VideoExcerptRange;
      try { range = validateVideoExcerptRange(input.range,sourceFacts.durationSec,limits); }
      catch(error) { throw new VideoExcerptError('PARAMETER_INVALID',error instanceof Error ? error.message : 'Choose a valid excerpt.'); }
      const result = await deps.trim(downloaded.bytes,sourceFacts,range,limits.maxDurationSec ?? undefined);
      validateVideoExcerptOutput(sourceFacts,result.facts,range);
      let outputDuration = result.facts.durationSec;
      const reauthorize = async () => {
        if (fingerprint(await deps.resolve(userId,input.source)) !== snapshot) throw new VideoExcerptError('SOURCE_CHANGED','The original video changed. Choose it again.');
        const current = await deps.engine(input.engineId), currentLimits = current && getVideoExcerptLimits(current,input.mode);
        if (!currentLimits) throw new VideoExcerptError('ENGINE_UNAVAILABLE','The selected model or mode became unavailable.');
        // Apply the model policy to the independently measured output, never to the original's stored duration.
        try { validateVideoExcerptRange({startSec:0,endSec:outputDuration},outputDuration,currentLimits); }
        catch { throw new VideoExcerptError('PARAMETER_INVALID','The prepared excerpt does not meet the current model source limits.'); }
        if (currentLimits.maxSizeMB && result.bytes.length > currentLimits.maxSizeMB*1024*1024) throw new VideoExcerptError('PREPARATION_LIMIT','The prepared excerpt exceeds this model’s source file size limit. Choose a shorter excerpt.');
      };
      await reauthorize();
      const asset = await deps.persist(userId,result.bytes,result.facts,{version:1,encoder:'h264-aac-v4',source:input.source,range,engineId:input.engineId,mode:input.mode,
        sourceFingerprint:snapshot,sourceSha256:createHash('sha256').update(downloaded.bytes).digest('hex'),sourceFacts,outputFacts:result.facts});
      if (!asset.ref || asset.ref.kind !== 'video' || JSON.stringify(asset.ref) === JSON.stringify(input.source)) throw new VideoExcerptError('PREPARATION_FAILED','The excerpt could not be saved as a distinct video.');
      outputDuration = asset.durationSec ?? Number.NaN;
      validateVideoExcerptOutput(sourceFacts,{...result.facts,durationSec:outputDuration},range);
      const prepared = await deps.resolve(userId,asset.ref);
      if (prepared.url !== asset.url) throw new VideoExcerptError('PREPARATION_FAILED','The stored excerpt changed during preparation.');
      await reauthorize();
      const playback = await deps.readAccess(userId,prepared);
      return {asset:{...asset,previewUrl:playback.url,thumbUrl:playback.thumbnailAccessUrl ?? asset.thumbUrl},range,original:input.source};
    } catch(error) {
      if (error instanceof VideoExcerptError) throw error;
      if (error instanceof Error && ['MEDIA_NOT_AVAILABLE','UNAUTHORIZED'].includes(error.message)) throw new VideoExcerptError('SOURCE_UNAVAILABLE','The selected video is no longer available to this account. Choose it again.');
      throw new VideoExcerptError('PREPARATION_FAILED','The excerpt could not be prepared. Try a smaller supported video or retry shortly.');
    }
  });
}
