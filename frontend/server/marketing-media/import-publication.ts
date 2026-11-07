import { randomUUID } from 'node:crypto';
import { withDbTransaction, type QueryExecutor } from '@/lib/db';
import type { MarketingMediaFile, MarketingMediaItem } from '@/lib/marketing-media';
import { MAX_MARKETING_PUBLICATION_BYTES, prepareMarketingPublicationImport } from './import-publication-manifest';
import { completeMarketingSnapshot, MarketingMediaError, record } from './snapshot';
import { marketingItem, readMarketingRow, type MarketingRow } from './store';
import { copyMarketingMediaFile } from './storage';

type ImportDependencies = {
  transaction: <T>(run: (db: QueryExecutor) => Promise<T>) => Promise<T>;
  copyFile: typeof copyMarketingMediaFile;
};
const defaults: ImportDependencies = { transaction: withDbTransaction, copyFile: copyMarketingMediaFile };
const PREPARATION_TIMEOUT_MS = 180_000;
const DB_TRANSACTION_TIMEOUT_MS = 5_000;
const deadlineError = () => new MarketingMediaError('The public media copy exceeded its preparation deadline.', 504);

function withBoundedImportTransaction<T>(
  transaction: ImportDependencies['transaction'],
  deadline: number,
  run: (db: QueryExecutor) => Promise<T>,
): Promise<T> {
  return transaction(async (db) => {
    // Check after pool acquisition. Bound both statements and the enclosing transaction,
    // which also covers a blocked COMMIT and releases the locks on timeout.
    const remaining = Math.min(DB_TRANSACTION_TIMEOUT_MS, deadline - Date.now());
    if (remaining <= 0) throw deadlineError();
    await db.query(
      `SELECT set_config('transaction_timeout',$1,true),set_config('statement_timeout',$1,true),
         set_config('lock_timeout',$2,true)`,
      [`${remaining}ms`, `${Math.min(2_000, remaining)}ms`],
    );
    return run(db);
  });
}

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

  const deadline = Date.now() + PREPARATION_TIMEOUT_MS;
  const cutoff = new Date(deadline).toISOString();
  const signal = AbortSignal.timeout(PREPARATION_TIMEOUT_MS);
  const deadlineExpired = () => signal.aborted || Date.now() >= deadline;
  const checkDeadline = () => {
    if (deadlineExpired()) throw deadlineError();
  };
  const { plan, files, sourceRecord, fingerprint } = prepareMarketingPublicationImport(input.manifest);
  const { videoId } = plan;
  const claim = await withBoundedImportTransaction(dependencies.transaction, deadline, async (db) => {
    checkDeadline();
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['marketing-media:' + videoId]);
    const previous = await readMarketingRow(videoId, db, true);
    checkDeadline();
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
       SELECT $1,$2,'copying',$3,$4,$5,$6,clock_timestamp()+interval '5 minutes',$7,true
       WHERE clock_timestamp()<$8::timestamptz
       ON CONFLICT(video_id) DO UPDATE SET state='copying',attempt_id=EXCLUDED.attempt_id,lease_until=EXCLUDED.lease_until,
         copied_by=EXCLUDED.copied_by,permission_confirmed=true,last_error=NULL,files='[]',size_bytes=0,updated_at=now()
       WHERE clock_timestamp()<$8::timestamptz
         AND (marketing_media.state='failed' OR (marketing_media.state='copying' AND marketing_media.lease_until<=clock_timestamp()))
       RETURNING video_id`,
      [videoId, copyId, fingerprint, JSON.stringify(plan.recreationSnapshot), JSON.stringify(sourceRecord), attemptId, input.actorId, cutoff],
    );
    if (!claimed.length) {
      checkDeadline();
      throw new MarketingMediaError('A copy is already in progress.', 409);
    }
    return { attemptId, copyId };
  });
  if (claim.ready) return marketingItem(claim.ready);

  const { attemptId, copyId } = claim;
  const copied: MarketingMediaFile[] = [];
  let sizeBytes = 0;
  const attemptIdentity = "video_id=$1 AND attempt_id=$2 AND source_fingerprint=$3 AND state='copying'";
  const currentAttempt = `${attemptIdentity} AND lease_until>clock_timestamp() AND clock_timestamp()<$4::timestamptz`;
  const attemptParams = [videoId, attemptId, fingerprint];
  const writeAttempt = <T>(sql: string, params: readonly unknown[]) =>
    withBoundedImportTransaction(dependencies.transaction, deadline, async (db) => {
      // PostgreSQL can evaluate UPDATE predicates before waiting on a row lock.
      // Acquire it first so the wall-clock predicate fences the actual mutation.
      const guardedParams = [...attemptParams, cutoff];
      const [locked] = await db.query(
        `SELECT video_id FROM marketing_media WHERE ${currentAttempt} FOR UPDATE`,
        guardedParams,
      );
      checkDeadline();
      return locked ? db.query<T>(sql, [...guardedParams, ...params]) : [];
    });
  try {
    for (const { media, expected } of files) {
      checkDeadline();
      const result = await dependencies.copyFile(media, {
        copyId, ownerId: null, remainingBytes: MAX_MARKETING_PUBLICATION_BYTES - sizeBytes, signal, expected,
      });
      checkDeadline();
      if (
        result.sourceUrl !== expected.url || result.sha256 !== expected.sha256 ||
        result.mime !== expected.mime || result.sizeBytes !== expected.sizeBytes
      ) throw new MarketingMediaError('A copied file does not match the public manifest.', 409);
      copied.push(result);
      sizeBytes += result.sizeBytes;
      const progress = await writeAttempt(
        `UPDATE marketing_media SET files=$5,size_bytes=$6,updated_at=now()
         WHERE ${currentAttempt} RETURNING video_id`,
        [JSON.stringify(copied), sizeBytes],
      );
      if (!progress.length) {
        checkDeadline();
        throw new MarketingMediaError('This import attempt is no longer current.', 409);
      }
    }
    const completed = completeMarketingSnapshot(plan, copied);
    const [ready] = await writeAttempt<MarketingRow>(
      `UPDATE marketing_media SET state='ready',publication=$5,recreation_snapshot=$6,files=$7,size_bytes=$8,
         lease_until=NULL,last_error=NULL,updated_at=now()
       WHERE ${currentAttempt} RETURNING *`,
      [JSON.stringify(completed.publication), JSON.stringify(completed.recreationSnapshot),
        JSON.stringify(completed.files), completed.sizeBytes],
    );
    if (!ready) {
      checkDeadline();
      throw new MarketingMediaError('This import attempt is no longer current.', 409);
    }
    return marketingItem(ready);
  } catch (error) {
    const failure = error instanceof MarketingMediaError
      ? error
      : deadlineExpired()
        ? deadlineError()
        : new MarketingMediaError('The public media copy failed. Retry when all required files are available.', 502);
    try {
      await withBoundedImportTransaction(dependencies.transaction, Date.now() + DB_TRANSACTION_TIMEOUT_MS, (db) => db.query(
        `UPDATE marketing_media SET state='failed',last_error=$4,lease_until=NULL,updated_at=now()
         WHERE ${attemptIdentity}`,
        [...attemptParams, failure.message],
      ));
    } catch (persistenceError) {
      const code = (persistenceError as { code?: unknown })?.code;
      console.warn('[marketing-media] Failed to record an import error', {
        videoId, ...(typeof code === 'string' && /^[A-Z0-9_]{1,40}$/.test(code) ? { code } : {}),
      });
    }
    throw failure;
  }
}
