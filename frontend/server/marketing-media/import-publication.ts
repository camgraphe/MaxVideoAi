import { randomUUID } from 'node:crypto';
import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import type { MarketingMediaFile, MarketingMediaItem } from '@/lib/marketing-media';
import { MAX_MARKETING_PUBLICATION_BYTES, prepareMarketingPublicationImport } from './import-publication-manifest';
import { completeMarketingSnapshot, MarketingMediaError, record } from './snapshot';
import { marketingItem, readMarketingRow, type MarketingRow } from './store';
import { copyMarketingMediaFile } from './storage';

type ImportDependencies = {
  db: QueryExecutor;
  transaction: typeof withDbTransaction;
  copyFile: typeof copyMarketingMediaFile;
};
const defaults: ImportDependencies = { db: { query }, transaction: withDbTransaction, copyFile: copyMarketingMediaFile };

export function previewMarketingPublicationImport(manifest: unknown) {
  return prepareMarketingPublicationImport(manifest).summary;
}

/** Called only by the authenticated admin route. All persisted state belongs to marketing media. */
export async function importMarketingPublication(
  input: { manifest: unknown; actorId: string; permissionConfirmed: boolean },
  dependencies: ImportDependencies = defaults,
): Promise<MarketingMediaItem> {
  if (!input.actorId.trim()) throw new MarketingMediaError('An administrator is required.', 403);
  if (input.permissionConfirmed !== true)
    throw new MarketingMediaError('Confirm permission to copy the public video and all of its references.', 403);

  const { plan, files, sourceRecord, fingerprint } = prepareMarketingPublicationImport(input.manifest);
  const { videoId } = plan;
  const signal = AbortSignal.timeout(180_000);
  const claim = await dependencies.transaction(async (db) => {
    await db.query("SET LOCAL lock_timeout='2s'");
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['marketing-media:' + videoId]);
    const previous = await readMarketingRow(videoId, db, true);
    if (previous?.tombstone || previous?.state === 'deleted' || previous?.state === 'deleting')
      throw new MarketingMediaError('This marketing publication is being removed or has been retired.', 409);
    if (previous && (
      record(previous.source_record).schemaVersion !== sourceRecord.schemaVersion ||
      previous.source_fingerprint !== fingerprint
    )) throw new MarketingMediaError('This video already has a different publication or import manifest.', 409);
    if (previous?.state === 'ready') return { ready: previous };

    const attemptId = randomUUID();
    const copyId = previous?.copy_id ?? randomUUID();
    const claimed = await db.query(
      `INSERT INTO marketing_media(video_id,copy_id,state,source_fingerprint,source_snapshot,source_record,attempt_id,lease_until,copied_by,permission_confirmed)
       VALUES($1,$2,'copying',$3,$4,$5,$6,now()+interval '5 minutes',$7,true)
       ON CONFLICT(video_id) DO UPDATE SET state='copying',attempt_id=EXCLUDED.attempt_id,lease_until=EXCLUDED.lease_until,
         copied_by=EXCLUDED.copied_by,permission_confirmed=true,last_error=NULL,files='[]',size_bytes=0,updated_at=now()
       WHERE marketing_media.state='failed' OR (marketing_media.state='copying' AND marketing_media.lease_until<=now())
       RETURNING video_id`,
      [videoId, copyId, fingerprint, JSON.stringify(plan.recreationSnapshot), JSON.stringify(sourceRecord), attemptId, input.actorId],
    );
    if (!claimed.length) throw new MarketingMediaError('A copy is already in progress.', 409);
    return { attemptId, copyId };
  });
  if (claim.ready) return marketingItem(claim.ready);

  const { attemptId, copyId } = claim;
  const copied: MarketingMediaFile[] = [];
  let sizeBytes = 0;
  const currentAttempt = "video_id=$1 AND attempt_id=$2 AND source_fingerprint=$3 AND state='copying' AND lease_until>now()";
  const attemptParams = [videoId, attemptId, fingerprint];
  try {
    for (const { media, expected } of files) {
      signal.throwIfAborted();
      const result = await dependencies.copyFile(media, {
        copyId, ownerId: null, remainingBytes: MAX_MARKETING_PUBLICATION_BYTES - sizeBytes, signal, expected,
      });
      signal.throwIfAborted();
      if (
        result.sourceUrl !== expected.url || result.sha256 !== expected.sha256 ||
        result.mime !== expected.mime || result.sizeBytes !== expected.sizeBytes
      ) throw new MarketingMediaError('A copied file does not match the public manifest.', 409);
      copied.push(result);
      sizeBytes += result.sizeBytes;
      const progress = await dependencies.db.query(
        `UPDATE marketing_media SET files=$4,size_bytes=$5,updated_at=now()
         WHERE ${currentAttempt} RETURNING video_id`,
        [...attemptParams, JSON.stringify(copied), sizeBytes],
      );
      if (!progress.length) throw new MarketingMediaError('This import attempt is no longer current.', 409);
    }
    const completed = completeMarketingSnapshot(plan, copied);
    signal.throwIfAborted();
    const [ready] = await dependencies.db.query<MarketingRow>(
      `UPDATE marketing_media SET state='ready',publication=$4,recreation_snapshot=$5,files=$6,size_bytes=$7,
         lease_until=NULL,last_error=NULL,updated_at=now()
       WHERE ${currentAttempt} RETURNING *`,
      [...attemptParams, JSON.stringify(completed.publication), JSON.stringify(completed.recreationSnapshot),
        JSON.stringify(completed.files), completed.sizeBytes],
    );
    if (!ready) throw new MarketingMediaError('This import attempt is no longer current.', 409);
    return marketingItem(ready);
  } catch (error) {
    const failure = error instanceof MarketingMediaError
      ? error
      : new MarketingMediaError('The public media copy failed. Retry when all required files are available.', 502);
    await dependencies.db.query(
      `UPDATE marketing_media SET state='failed',last_error=$4,lease_until=NULL,updated_at=now()
       WHERE video_id=$1 AND attempt_id=$2 AND source_fingerprint=$3 AND state='copying'`,
      [...attemptParams, failure.message],
    );
    throw failure;
  }
}
