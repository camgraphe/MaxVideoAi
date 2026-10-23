import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { Mode } from '@/types/engines';
import { toolAssetRefSchema } from '@/lib/toolbox/contract';
import { canonicalMediaAssetFields } from '@/lib/media-identity';
import { getMediaExcerptLimits, validateVideoExcerptRange, VIDEO_EXCERPT_PREPARATION_LIMITS } from '@/lib/video-excerpt';
import { resolveStudioMedia } from '@/server/studio/media-resolver';
import { createConversationMediaReadAccess } from '@/server/studio/conversation-media-read-access';
import { getReadOnlyConfiguredEngine } from '@/server/agent-api/read-only-engine-catalog';
import { storeAudioUpload } from '@/server/uploads/store-media-upload';
import { VideoExcerptError, withVideoExcerptSlot } from './media';
import { downloadAudioExcerptMedia, inspectAudioExcerptBytes, trimAudioExcerptBytes, validateAudioExcerptOutput } from './audio-media';

const schema = z.object({
  source: toolAssetRefSchema.refine(ref => ref.kind === 'audio'), engineId: z.string().trim().min(1).max(128),
  mode: z.enum(['t2v', 'i2v', 'ref2v', 'fl2v', 'v2v', 'extend', 'reframe', 'retake', 'r2v', 'a2v']),
  fieldId: z.string().trim().min(1).max(128),
  range: z.object({ startSec: z.number().finite().nonnegative(), endSec: z.number().finite().positive() }).strict(),
}).strict();
const defaults = { engine: getReadOnlyConfiguredEngine, resolve: resolveStudioMedia, readAccess: createConversationMediaReadAccess,
  download: downloadAudioExcerptMedia, inspect: inspectAudioExcerptBytes, trim: trimAudioExcerptBytes, store: storeAudioUpload };
type Dependencies = typeof defaults;
const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Same owned upload operation as video; no generation, wallet or public publication. */
export async function prepareAudioExcerpt(userId: string, value: unknown, dependencies: Partial<Dependencies> = {}) {
  if (!userId) throw new VideoExcerptError('AUTH_REQUIRED', 'Authenticate before preparing audio.');
  const parsed = schema.safeParse(value);
  if (!parsed.success || parsed.data.range.endSec <= parsed.data.range.startSec) throw new VideoExcerptError('PARAMETER_INVALID', 'Choose an audio source and range.');
  const input = parsed.data, deps = { ...defaults, ...dependencies };
  if (input.range.endSec - input.range.startSec > VIDEO_EXCERPT_PREPARATION_LIMITS.maxExcerptSec)
    throw new VideoExcerptError('PREPARATION_LIMIT', 'Choose a passage up to 60 seconds.');
  const readLimits = async () => {
    const engine = await deps.engine(input.engineId);
    const field = [...(engine?.inputSchema?.required ?? []), ...(engine?.inputSchema?.optional ?? [])]
      .find(field => field.id === input.fieldId && field.type === 'audio' && (!field.modes?.length || field.modes.includes(input.mode as Mode)));
    const limits = engine && field && getMediaExcerptLimits(engine, input.mode, input.fieldId);
    if (!limits) throw new VideoExcerptError('ENGINE_UNAVAILABLE', 'This audio input is unavailable.');
    return limits;
  };
  return withVideoExcerptSlot(userId, async () => {
    try {
      const limits = await readLimits();
      const original = await deps.resolve(userId, input.source), snapshot = fingerprint(original);
      if (original.kind !== 'audio') throw new VideoExcerptError('SOURCE_UNAVAILABLE', 'Choose an audio source.');
      const access = await deps.readAccess(userId, original);
      const downloaded = await deps.download({ file_id: original.id, download_url: access.url, mime_type: original.mime });
      const sourceFacts = await deps.inspect(downloaded.bytes);
      try { validateVideoExcerptRange(input.range, sourceFacts.durationSec, limits); }
      catch { throw new VideoExcerptError('PARAMETER_INVALID', 'The audio passage is outside this input’s limits.'); }
      const result = await deps.trim(downloaded.bytes, sourceFacts, input.range);
      validateAudioExcerptOutput(sourceFacts, result.facts, input.range);
      const reauthorize = async (duration: number) => {
        if (fingerprint(await deps.resolve(userId, input.source)) !== snapshot) throw new VideoExcerptError('SOURCE_CHANGED', 'Choose the source again.');
        const current = await readLimits();
        try { validateVideoExcerptRange({ startSec: 0, endSec: duration }, duration, current); }
        catch { throw new VideoExcerptError('PARAMETER_INVALID', 'The prepared audio is outside the current input limits.'); }
        if (current.maxSizeMB && result.bytes.length > current.maxSizeMB * 1024 * 1024) throw new VideoExcerptError('PREPARATION_LIMIT', 'Choose a shorter audio passage.');
      };
      await reauthorize(result.facts.durationSec);
      const lineage = { version: 3, storageAccess: 'private', encoder: 'pcm-s16le-48k-v1', source: input.source, range: input.range,
        engineId: input.engineId, mode: input.mode, fieldId: input.fieldId, sourceFingerprint: snapshot,
        sourceSha256: createHash('sha256').update(downloaded.bytes).digest('hex'), sourceFacts, outputFacts: result.facts };
      // Reuse the installed reserved private excerpt leaf policy for audio too.
      const stored = await deps.store({ userId, bytes: result.bytes, fileName: 'audio-excerpt.wav', declaredMime: 'audio/wav',
        contentAddressedNamespace: `audio-excerpt-private-v3-${fingerprint(lineage)}`, privateStorageScope: 'video-excerpt',
        storageAcl: null, storageCacheControl: 'private, no-store', metadata: { audioExcerpt: lineage } });
      if (Math.abs(stored.durationSec - result.facts.durationSec) > 1 / 48000 + 1e-8 || !Number.isFinite(stored.durationSec)
        || stored.width != null || stored.height != null || stored.mimeType !== 'audio/wav')
        throw new VideoExcerptError('PREPARATION_FAILED', 'Stored audio could not be verified.');
      const identity = canonicalMediaAssetFields(stored.assetId, 'audio');
      if (JSON.stringify(identity.ref) === JSON.stringify(input.source)) throw new VideoExcerptError('PREPARATION_FAILED', 'The passage must remain distinct from the original.');
      const prepared = await deps.resolve(userId, identity.ref!);
      if (prepared.kind !== 'audio' || prepared.url !== stored.storageUrl) throw new VideoExcerptError('PREPARATION_FAILED', 'Stored audio changed.');
      await reauthorize(stored.durationSec);
      const playback = await deps.readAccess(userId, prepared);
      return { asset: { id: stored.legacyAssetId, legacyAssetId: stored.legacyAssetId, ...identity, mediaFacts: stored.mediaFacts,
        url: stored.storageUrl, previewUrl: playback.url, durationSec: stored.durationSec, size: stored.sizeBytes,
        mime: stored.mimeType, name: 'audio-excerpt.wav' }, range: input.range, original: input.source };
    } catch (error) {
      if (error instanceof VideoExcerptError) throw error;
      if (error instanceof Error && ['MEDIA_NOT_AVAILABLE', 'UNAUTHORIZED'].includes(error.message)) throw new VideoExcerptError('SOURCE_UNAVAILABLE', 'The audio is unavailable to this account.');
      throw new VideoExcerptError('PREPARATION_FAILED', 'Unable to prepare this audio passage.');
    }
  });
}
