import { createHash } from 'node:crypto';
import { AgentApiError } from '@/server/agent-api/errors';
import { creatorOperationInputSchema, type CreatorOperationInput } from '@/lib/toolbox/creator-tools';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
import { resolveStudioMedia, type StudioResolvedMedia } from '@/server/studio/media-resolver';
import { buildObjectKey, uploadFileBufferToKey } from '@/server/storage';
import { stableJson } from '@/server/agent-api/generation-normalization';
import { ensureReusableAsset } from '@/server/media-library';
import { createUploadVideoThumbnail, createUploadImageThumbnail } from '@/server/upload-thumbnails';
import { downloadCreatorMedia, inspectCreatorBytes, trimCreatorBytes, validateCreatorSegment, withCreatorMediaSlot } from './creator-segment-media';
import { prepareCreatorProfile, isCreatorLipVideoEnabled, isCreatorMotionControlEnabled, type CreatorMediaFacts, type CreatorResolvedSource } from './creator-profiles';

export const creatorSourceFingerprint = (media: StudioResolvedMedia): string => createHash('sha256').update(JSON.stringify({id:media.id,ref:media.ref,url:media.url,kind:media.kind,mime:media.mime,sizeBytes:media.sizeBytes,width:media.width,height:media.height,durationSec:media.durationSec})).digest('hex');
export type CreatorSourcesDependencies = {
  resolve: typeof resolveStudioMedia;
  readAccess: typeof createConversationMediaReadAccess;
  download: typeof downloadCreatorMedia;
  inspect: typeof inspectCreatorBytes;
  trim: typeof trimCreatorBytes;
  persist: typeof persistCreatorMedia;
};
/** Produces a distinct owned library asset; never overwrites a source or a generation output. */
export async function persistCreatorMedia(userId: string, bytes: Uint8Array, facts: CreatorMediaFacts, lineage: Record<string, unknown>) {
  const identity=createHash('sha256').update(stableJson(lineage)).update(bytes).digest('hex');
  const extension=({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp','video/mp4':'mp4','video/quicktime':'mov','video/webm':'webm','audio/wav':'wav','audio/x-wav':'wav','audio/mpeg':'mp3','audio/mp4':'m4a','audio/aac':'aac','audio/ogg':'ogg','audio/flac':'flac' } as Record<string,string>)[facts.mimeType];
  if(!extension)throw new AgentApiError('REFERENCE_INVALID','Unsupported prepared media type.');
  // The lineage and received bytes determine an immutable key. A lease retry writes identical bytes;
  // a different operation/source cannot replace the original or deduplicate into its identity.
  const key=buildObjectKey({prefix:'files',userId,leafName:`creator-${identity}.${extension}`});
  const stored = await uploadFileBufferToKey({ key, data:Buffer.from(bytes), mime:facts.mimeType });
  const thumbnailUrl = facts.kind === 'video'
    ? await createUploadVideoThumbnail({data:Buffer.from(bytes),userId,fileName:'creator-media'})
    : facts.kind === 'image' ? await createUploadImageThumbnail({data:Buffer.from(bytes),userId,fileName:'creator-media'}) : null;
  const asset = await ensureReusableAsset({ userId, url: stored.url, kind: facts.kind, source: 'import', mimeType: facts.mimeType,
    width: facts.width, height: facts.height, sizeBytes: facts.sizeBytes, durationSec: facts.durationSec,
    thumbUrl: thumbnailUrl, allowRemoteThumbnailFallback: false,
    metadata: { creator: lineage, durationSec: facts.durationSec, mediaFacts: {source:'probe',...facts} } });
  if (!asset.publicId) throw new Error('The prepared media could not be saved.');
  return { asset: {type:'asset' as const,assetId:asset.publicId,kind:facts.kind}, url: asset.url, thumbnailUrl: asset.thumbUrl };
}
const defaults: CreatorSourcesDependencies = { readAccess:createConversationMediaReadAccess, resolve:resolveStudioMedia, download:downloadCreatorMedia, inspect:inspectCreatorBytes, trim:trimCreatorBytes, persist:persistCreatorMedia };
export async function resolveCreatorSources(input: CreatorOperationInput, userId: string, dependencies: Partial<CreatorSourcesDependencies> = {}): Promise<CreatorResolvedSource[]> {
  const deps = {...defaults,...dependencies};
  const sources: CreatorResolvedSource[] = [];
  for (const entry of input.inputs) {
    const original = await deps.resolve(userId,entry.source);
    const fingerprint = creatorSourceFingerprint(original);
    const access = await deps.readAccess(userId,original);
    const downloaded = await deps.download({file_id:original.id,download_url:access.url});
    let bytes: Uint8Array = downloaded.bytes;
    let facts = await deps.inspect(bytes,entry.source.kind,downloaded.mimeType);
    if (facts.kind !== entry.source.kind) throw new AgentApiError('REFERENCE_INVALID','Source kind changed. Choose the source again.');
    if (entry.segment) {
      const segment = validateCreatorSegment(entry.segment,facts.durationSec ?? 0)!;
      const trimmed = await deps.trim(bytes,facts,segment); bytes=trimmed.bytes; facts=trimmed.facts;
    }
    // Slow downloads/probes must not authorize a source that was hidden, deleted or changed meanwhile.
    if (creatorSourceFingerprint(await deps.resolve(userId,entry.source)) !== fingerprint) throw new AgentApiError('REFERENCE_INVALID','Source changed during preparation. Choose it again.');
    const saved = await deps.persist(userId,bytes,facts,{version:1,role:entry.role,source:entry.source,segment:entry.segment ?? null,sourceFingerprint:fingerprint});
    sources.push({input:entry,asset:saved.asset,url:saved.url,facts,fingerprint});
  }
  return sources;
}
export async function prepareCreatorOperation(value: unknown, userId: string, dependencies: Partial<CreatorSourcesDependencies> = {}) {
  if (!userId) throw new AgentApiError('AUTH_REQUIRED','Authenticate before preparing a tool.');
  const input = creatorOperationInputSchema.parse(value);
  // Reject closed profiles before performing storage work. Duration compatibility is validated again in the profile.
  if (input.profileId==='motion-kling-v3-v1'&&!isCreatorMotionControlEnabled()) throw new AgentApiError('ENGINE_UNAVAILABLE','This specialist profile requires qualification.');
  if (input.toolId === 'product-photo-editor' && (input.settings.preservation === 'pixels' || input.inputs.some(entry=>entry.role==='mask'))) throw new AgentApiError('ENGINE_UNAVAILABLE','Pixel or masked preservation requires qualification.');
  if (input.toolId === 'lip-sync' && input.settings.mode === 'video'&&!isCreatorLipVideoEnabled()) throw new AgentApiError('ENGINE_UNAVAILABLE','Video Lip Sync requires qualification before activation.');
  try {return await withCreatorMediaSlot(userId,async()=>prepareCreatorProfile(input,await resolveCreatorSources(input,userId,dependencies)));}
  catch(error){if(error instanceof AgentApiError)throw error;throw new AgentApiError('REFERENCE_INVALID','The selected media could not be prepared. Choose a supported owned source and retry.');}
}
export async function revalidateCreatorSources(userId: string, sources: CreatorResolvedSource[]): Promise<void> {
  for (const source of sources) {
    const current=await resolveStudioMedia(userId,source.input.source);
    if (creatorSourceFingerprint(current)!==source.fingerprint) throw new AgentApiError('REFERENCE_INVALID','An original source changed. Prepare a new quote.');
    await resolveStudioMedia(userId,source.asset);
  }
}
