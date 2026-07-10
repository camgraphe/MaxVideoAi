import { query, withDbTransaction, type QueryExecutor } from '@/lib/db';
import type {
  TimelineExportBillingKind,
  TimelineExportBillingStatus,
  TimelineExportJobResponse,
  TimelineExportStatus,
} from './contracts';
import { ensureTimelineExportSchema } from './schema';

export type TimelineExportJobRecord = {
  id: string;
  user_id: string;
  idempotency_key: string;
  project_name: string;
  status: TimelineExportStatus;
  progress: number;
  message: string | null;
  duration_sec: string | number;
  resolution: string | null;
  fps: number | null;
  quality_preset: string;
  amount_cents: number;
  currency: string;
  billing_kind: TimelineExportBillingKind;
  billing_status: TimelineExportBillingStatus;
  render_manifest: unknown;
  export_settings: unknown;
  output_url: string | null;
  output_asset_id: string | null;
  output_size_bytes: string | number | null;
  output_mime_type: string | null;
  created_at: string;
  updated_at: string;
};

function nullableTimelineExportSize(value: string | number | null): number | null {
  if (value === null) return null;
  const size = Number(value);
  return Number.isFinite(size) ? size : null;
}

export function timelineExportJobResponse(job: TimelineExportJobRecord): TimelineExportJobResponse {
  const outputUrl = job.status === 'completed' ? job.output_url : null;

  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    message: job.message,
    artifact: outputUrl
      ? {
        outputUrl,
        outputAssetId: job.output_asset_id,
        sizeBytes: nullableTimelineExportSize(job.output_size_bytes),
        mimeType: job.output_mime_type,
      }
      : null,
  };
}

export function timelineExportIdFromIdempotencyKey(idempotencyKey: string): string {
  const safeKey = idempotencyKey.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 80);
  return `tlx_${safeKey || Date.now().toString(36)}`;
}

export async function countUsedFreeTimelineExports(userId: string, executor: QueryExecutor = { query }): Promise<number> {
  await ensureTimelineExportSchema();
  const rows = await executor.query<{ count: string | number }>(
    `SELECT COUNT(*)::int AS count
       FROM app_timeline_exports
      WHERE user_id = $1
        AND billing_status IN ('free_reserved','free_completed')`,
    [userId]
  );
  return Number(rows[0]?.count ?? 0);
}

export async function readTimelineExportJobByIdempotencyKey(params: {
  userId: string;
  idempotencyKey: string;
}): Promise<TimelineExportJobRecord | null> {
  await ensureTimelineExportSchema();
  const rows = await query<TimelineExportJobRecord>(
    `SELECT *
       FROM app_timeline_exports
      WHERE user_id = $1
        AND idempotency_key = $2
      LIMIT 1`,
    [params.userId, params.idempotencyKey]
  );
  return rows[0] ?? null;
}

export async function createTimelineExportJob(params: {
  userId: string;
  id?: string;
  idempotencyKey: string;
  projectName: string;
  durationSec: number;
  resolution: string | null;
  fps: number | null;
  qualityPreset: string;
  amountCents: number;
  currency: string;
  billingKind: TimelineExportBillingKind;
  billingStatus: TimelineExportBillingStatus;
  renderManifest: unknown;
  exportSettings: unknown;
}): Promise<TimelineExportJobRecord> {
  await ensureTimelineExportSchema();
  const id = params.id ?? timelineExportIdFromIdempotencyKey(params.idempotencyKey);
  const rows = await query<TimelineExportJobRecord>(
    `INSERT INTO app_timeline_exports (
        id, user_id, idempotency_key, project_name, duration_sec, resolution, fps,
        quality_preset, amount_cents, currency, billing_kind, billing_status,
        render_manifest, export_settings
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
      ON CONFLICT (user_id, idempotency_key)
      DO UPDATE SET updated_at = app_timeline_exports.updated_at
      RETURNING *`,
    [
      id,
      params.userId,
      params.idempotencyKey,
      params.projectName,
      params.durationSec,
      params.resolution,
      params.fps,
      params.qualityPreset,
      params.amountCents,
      params.currency,
      params.billingKind,
      params.billingStatus,
      JSON.stringify(params.renderManifest),
      JSON.stringify(params.exportSettings),
    ]
  );
  return rows[0];
}

export async function readTimelineExportJob(params: {
  userId: string;
  exportId: string;
}): Promise<TimelineExportJobRecord | null> {
  await ensureTimelineExportSchema();
  const rows = await query<TimelineExportJobRecord>(
    `SELECT * FROM app_timeline_exports WHERE id = $1 AND user_id = $2 LIMIT 1`,
    [params.exportId, params.userId]
  );
  return rows[0] ?? null;
}

export async function claimNextQueuedTimelineExport(): Promise<TimelineExportJobRecord | null> {
  await ensureTimelineExportSchema();
  return withDbTransaction(async (executor) => {
    const rows = await executor.query<TimelineExportJobRecord>(
      `UPDATE app_timeline_exports
          SET status = 'rendering',
              progress = 5,
              started_at = NOW(),
              updated_at = NOW()
        WHERE id = (
          SELECT id
            FROM app_timeline_exports
           WHERE status = 'queued'
           ORDER BY created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        RETURNING *`
    );
    return rows[0] ?? null;
  });
}

export async function claimQueuedTimelineExportById(exportId: string): Promise<TimelineExportJobRecord | null> {
  await ensureTimelineExportSchema();
  return withDbTransaction(async (executor) => {
    const rows = await executor.query<TimelineExportJobRecord>(
      `UPDATE app_timeline_exports
          SET status = 'rendering',
              progress = 5,
              started_at = NOW(),
              updated_at = NOW()
        WHERE id = (
          SELECT id
            FROM app_timeline_exports
           WHERE id = $1
             AND status = 'queued'
           FOR UPDATE SKIP LOCKED
           LIMIT 1
        )
        RETURNING *`,
      [exportId]
    );
    return rows[0] ?? null;
  });
}

export async function updateTimelineExportProgress(params: {
  exportId: string;
  progress: number;
  message: string;
}): Promise<void> {
  await query(
    `UPDATE app_timeline_exports
        SET progress = $2,
            message = $3,
            updated_at = NOW()
      WHERE id = $1`,
    [params.exportId, Math.max(0, Math.min(99, Math.round(params.progress))), params.message]
  );
}

export async function completeTimelineExportJob(params: {
  exportId: string;
  outputUrl: string;
  outputAssetId: string | null;
  sizeBytes: number | null;
  mimeType: string;
  billingStatus: TimelineExportBillingStatus;
}): Promise<void> {
  await query(
    `UPDATE app_timeline_exports
        SET status = 'completed',
            progress = 100,
            message = 'Export ready.',
            output_url = $2,
            output_asset_id = $3,
            output_size_bytes = $4,
            output_mime_type = $5,
            billing_status = $6,
            completed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [params.exportId, params.outputUrl, params.outputAssetId, params.sizeBytes, params.mimeType, params.billingStatus]
  );
}

export async function failTimelineExportJob(params: {
  exportId: string;
  message: string;
  billingStatus: TimelineExportBillingStatus;
}): Promise<void> {
  await query(
    `UPDATE app_timeline_exports
        SET status = 'failed',
            message = $2,
            billing_status = $3,
            failed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [params.exportId, params.message, params.billingStatus]
  );
}
