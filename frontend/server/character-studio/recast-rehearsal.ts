import { readRecastPublicPrice } from './recast-public-price';
import { query } from '@/lib/db';
import {
  ownedMediaStorageKeyForUrl,
  getStorageObjectBuffer,
  getStorageObjectMetadata,
} from '@/server/storage';
import {
  inspectVideoExcerptBytes,
  trimVideoExcerptBytes,
  withVideoExcerptSlot,
} from '@/server/video-excerpts/media';
import { inspectAudioExcerptBytes, trimAudioExcerptBytes } from '@/server/video-excerpts/audio-media';
import { validateVideoExcerptRange } from '@/lib/video-excerpt';
import { resolveStudioOutput } from './source';
import { recastSettings } from './recast-request';
import { AgentApiError } from '@/server/agent-api/errors';

/** Explicit local rehearsal. Never issue a spendable quote or submit local storage URLs. */
export function localRecastRehearsalEnabled() {
  if (process.env.NODE_ENV !== 'development' || process.env.CHARACTER_STUDIO_RECAST_REHEARSAL !== '1')
    return false;
  try {
    const db = new URL(process.env.DATABASE_URL!);
    const endpoint = new URL(process.env.AWS_ENDPOINT_URL_S3!);
    const storage = new URL(process.env.S3_PUBLIC_BASE_URL!);
    return (
      db.pathname === '/character_studio_test' &&
      ['localhost', '127.0.0.1'].includes(db.hostname) &&
      db.searchParams.get('host')?.startsWith('/') === true &&
      endpoint.hostname === '127.0.0.1' &&
      endpoint.origin === storage.origin &&
      process.env.S3_BUCKET === 'character-studio-test'
    );
  } catch {
    return false;
  }
}
async function localAsset(userId: string, assetId: string, kind: 'audio' | 'image' | 'video') {
  const [row] = await query<{ url: string; mime_type: string }>(
    `SELECT url,mime_type FROM media_assets
    WHERE public_id=$1 AND user_id=$2 AND kind=$3 AND status='ready' AND deleted_at IS NULL AND source_job_id IS NULL`,
    [assetId, userId, kind],
  );
  const key = row && ownedMediaStorageKeyForUrl({ url: row.url, userId });
  if (!key) throw new AgentApiError('REFERENCE_INVALID', 'Choose an owned upload.');
  return { key, mime: row.mime_type };
}

export async function rehearseRecast(userId: string, value: unknown) {
  if (!localRecastRehearsalEnabled()) throw new AgentApiError('ENGINE_UNAVAILABLE', 'Preview disabled.');
  const s = recastSettings.parse(value);
  if ('jobId' in s.portrait)
    await resolveStudioOutput({ query }, userId, s.portrait.jobId, s.portrait.imageUrl);
  else await localAsset(userId, s.portrait.assetId, 'image');
  if (s.product) await localAsset(userId, s.product, 'image');
  const measured = { video: 0, audio: 0 };
  await withVideoExcerptSlot(userId, async () => {
    for (const kind of ['video', 'audio'] as const) {
      const track = s[kind];
      if (!track) continue;
      const { key, mime } = await localAsset(userId, track.assetId, kind);
      const { size } = await getStorageObjectMetadata(key);
      const maxBytes = (kind === 'video' ? 100 : 15) * 1024 * 1024;
      if (!size || size > maxBytes) throw new AgentApiError('REFERENCE_INVALID', 'File too large.');
      const bytes = await getStorageObjectBuffer(key, { signal: AbortSignal.timeout(30000), maxBytes });
      if (bytes.length !== size) throw new AgentApiError('REFERENCE_INVALID', 'Source changed.');
      if (kind === 'video') {
        const facts = await inspectVideoExcerptBytes(bytes, mime);
        validateVideoExcerptRange(track.range, facts.durationSec, {
          sourceFieldId: 'video_url',
          durationPolicy: 'requested',
          maxSizeMB: 100,
          minDurationSec: null,
          maxDurationSec: 15,
        });
        measured.video = (await trimVideoExcerptBytes(bytes, facts, track.range, 15)).facts.durationSec;
      } else {
        const facts = await inspectAudioExcerptBytes(bytes);
        measured.audio = (await trimAudioExcerptBytes(bytes, facts, track.range)).facts.durationSec;
      }
    }
  });
  const mode = s.video ? 'v2v' : s.audio || s.product ? 'ref2v' : 'i2v';
  const rate = await readRecastPublicPrice({
    modelId: 'wan-3-prime',
    mode,
    durationSec: s.seconds,
    resolution: s.resolution,
    aspectRatio: s.aspectRatio === 'auto' ? undefined : s.aspectRatio,
    ...(mode === 'i2v' ? {} : { inputVideoDurationSec: measured.video }),
    audio: Boolean(s.dialogue || s.audio),
  });
  if (
    rate.status !== 'exact' ||
    rate.currency !== 'USD' ||
    !Number.isSafeInteger(rate.amountCents) ||
    rate.amountCents <= 0
  ) {
    throw new AgentApiError('ENGINE_UNAVAILABLE', 'Published price is unavailable.');
  }
  return {
    kind: 'rehearsal' as const,
    amountCents: rate.amountCents,
    currency: 'USD',
    revision: rate.revision,
    sourceSeconds: measured.video,
    audioSeconds: measured.audio,
  };
}
