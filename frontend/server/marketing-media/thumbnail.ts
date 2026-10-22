import { createHash } from 'node:crypto';
import { withDbTransaction } from '@/lib/db';
import { uploadFileBufferToKey } from '@/server/storage';
import { ensureJobThumbnail } from '@/server/thumbnails';
import { marketingMediaEnabled, readMarketingRow } from './store';
import { MarketingMediaError } from './snapshot';
import type { MarketingMediaFile } from '@/lib/marketing-media';

export async function refreshMarketingThumbnail(videoId: string, seekSec: number): Promise<string | null> {
  if (!marketingMediaEnabled()) return null;
  return withDbTransaction(async (db) => {
    const row = await readMarketingRow(videoId, db, true);
    if (!row) return null;
    if (row.state !== 'ready') throw new MarketingMediaError('The marketing copy is not ready.', 409);
    let file: MarketingMediaFile | undefined;
    const thumbUrl = await ensureJobThumbnail({
      jobId: videoId,
      videoUrl: String(row.publication.video_url),
      aspectRatio: String(row.publication.aspect_ratio ?? '16:9'),
      seekSec,
      force: true,
      storeImage: async (data) => {
        const sha256 = createHash('sha256').update(data).digest('hex');
        const mime = 'image/jpeg';
        const stored = await uploadFileBufferToKey({
          key: `marketing-media/${row.copy_id}/${sha256}.jpg`,
          data,
          mime,
          cacheControl: 'public, max-age=31536000, immutable',
        });
        file = { ...stored, sourceUrl: stored.url, sizeBytes: data.length, mime, sha256 };
        return { ...stored, width: null, height: null, size: data.length, mime };
      },
    });
    if (!thumbUrl || !file) throw new MarketingMediaError('Thumbnail capture failed.', 502);
    const updated = await db.query(
      `UPDATE marketing_media SET publication=publication||jsonb_build_object('thumb_url',$2::text),
  size_bytes=size_bytes+CASE WHEN files @> $3::jsonb THEN 0 ELSE $5::bigint END,
  files=CASE WHEN files @> $3::jsonb THEN files ELSE files||$3::jsonb END, updated_at=now()
  WHERE video_id=$1 AND state='ready' AND updated_at=$4 RETURNING video_id`,
      [videoId, thumbUrl, JSON.stringify([file]), row.updated_at, file.sizeBytes],
    );
    if (!updated.length) throw new MarketingMediaError('The publication changed. Retry the thumbnail capture.', 409);
    return thumbUrl;
  });
}
