import { query, withDbTransaction } from '@/lib/db';
import { ensureBillingSchema } from '@/lib/schema';
import type { WorkspaceTimelineExportQualityPreset } from '../../../app/(core)/(workspace)/app/studio/workspace/_lib/workspace-timeline-export';
import type { TimelineExportBillingStatus } from './contracts';
import { estimateTimelineExportPrice, resolveTimelineExportQuota } from './pricing';
import {
  countUsedFreeTimelineExports,
  timelineExportIdFromIdempotencyKey,
  type TimelineExportJobRecord,
} from './repository';
import { ensureTimelineExportSchema } from './schema';

export type TimelineExportBillingReservation = {
  billingKind: 'free' | 'paid';
  billingStatus: TimelineExportBillingStatus;
  amountCents: number;
  currency: 'USD';
  freeLimit: number;
  freeExportsRemaining: number;
  usedFreeExports: number;
};

export type TimelineExportJobReservationResult = {
  job: TimelineExportJobRecord;
  billing: TimelineExportBillingReservation | null;
  reused: boolean;
};

export async function reserveTimelineExportBilling(params: {
  userId: string;
  exportId: string;
  projectName: string;
  durationSec: number;
  resolution: string | null;
  fps: number | null;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  pricingSnapshot: Record<string, unknown>;
}): Promise<TimelineExportBillingReservation> {
  await ensureBillingSchema();

  return withDbTransaction(async (executor) => {
    await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`timeline-export:${params.userId}`]);
    const usedFreeExports = await countUsedFreeTimelineExports(params.userId, executor);
    const quota = resolveTimelineExportQuota({ usedFreeExports });
    const estimate = estimateTimelineExportPrice({
      durationSec: params.durationSec,
      resolution: params.resolution,
      fps: params.fps,
      qualityPreset: params.qualityPreset,
      freeExportsRemaining: quota.freeExportsRemaining,
    });

    if (estimate.billingKind === 'free') {
      return {
        billingKind: 'free',
        billingStatus: 'free_reserved',
        amountCents: 0,
        currency: 'USD',
        freeLimit: quota.freeLimit,
        freeExportsRemaining: Math.max(0, quota.freeExportsRemaining - 1),
        usedFreeExports,
      };
    }

    const walletRows = await executor.query<{ balance_cents: string | number }>(
      `SELECT GREATEST(0,
          COALESCE(SUM(CASE WHEN type = 'topup' THEN amount_cents ELSE 0 END), 0)
        + COALESCE(SUM(CASE WHEN type = 'refund' THEN amount_cents ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN type = 'charge' THEN amount_cents ELSE 0 END), 0)
      )::int AS balance_cents
       FROM app_receipts
      WHERE user_id = $1
        AND (currency IS NULL OR UPPER(currency) = 'USD')`,
      [params.userId]
    );
    const balanceCents = Number(walletRows[0]?.balance_cents ?? 0);
    if (balanceCents < estimate.amountCents) {
      throw new Error('INSUFFICIENT_WALLET_BALANCE');
    }

    await executor.query(
      `INSERT INTO app_receipts (
          user_id, type, amount_cents, currency, description, job_id, surface,
          billing_product_key, pricing_snapshot, metadata
        )
        VALUES ($1,'charge',$2,'USD',$3,$4,'timeline_export','server_render',$5::jsonb,$6::jsonb)
        ON CONFLICT DO NOTHING`,
      [
        params.userId,
        estimate.amountCents,
        `Server export ${params.projectName} - ${Math.ceil(params.durationSec)}s`,
        params.exportId,
        JSON.stringify(params.pricingSnapshot),
        JSON.stringify({ product: 'maxvideoai-editor-server-export' }),
      ]
    );

    return {
      billingKind: 'paid',
      billingStatus: 'paid_reserved',
      amountCents: estimate.amountCents,
      currency: 'USD',
      freeLimit: quota.freeLimit,
      freeExportsRemaining: 0,
      usedFreeExports,
    };
  });
}

export async function createTimelineExportJobWithReservation(params: {
  userId: string;
  idempotencyKey: string;
  projectName: string;
  durationSec: number;
  resolution: string | null;
  fps: number | null;
  qualityPreset: WorkspaceTimelineExportQualityPreset;
  pricingSnapshot: Record<string, unknown>;
  renderManifest: unknown;
  exportSettings: unknown;
}): Promise<TimelineExportJobReservationResult> {
  await ensureBillingSchema();
  await ensureTimelineExportSchema();

  return withDbTransaction(async (executor) => {
    await executor.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`timeline-export:${params.userId}`]);
    const existingRows = await executor.query<TimelineExportJobRecord>(
      `SELECT *
         FROM app_timeline_exports
        WHERE user_id = $1
          AND idempotency_key = $2
        LIMIT 1`,
      [params.userId, params.idempotencyKey]
    );
    const existingJob = existingRows[0] ?? null;
    if (existingJob) {
      return { job: existingJob, billing: null, reused: true };
    }

    const exportId = timelineExportIdFromIdempotencyKey(params.idempotencyKey);
    const usedFreeExports = await countUsedFreeTimelineExports(params.userId, executor);
    const quota = resolveTimelineExportQuota({ usedFreeExports });
    const estimate = estimateTimelineExportPrice({
      durationSec: params.durationSec,
      resolution: params.resolution,
      fps: params.fps,
      qualityPreset: params.qualityPreset,
      freeExportsRemaining: quota.freeExportsRemaining,
    });

    const billing: TimelineExportBillingReservation =
      estimate.billingKind === 'free'
        ? {
            billingKind: 'free',
            billingStatus: 'free_reserved',
            amountCents: 0,
            currency: 'USD',
            freeLimit: quota.freeLimit,
            freeExportsRemaining: Math.max(0, quota.freeExportsRemaining - 1),
            usedFreeExports,
          }
        : {
            billingKind: 'paid',
            billingStatus: 'paid_reserved',
            amountCents: estimate.amountCents,
            currency: 'USD',
            freeLimit: quota.freeLimit,
            freeExportsRemaining: 0,
            usedFreeExports,
          };

    if (estimate.billingKind === 'paid') {
      const walletRows = await executor.query<{ balance_cents: string | number }>(
        `SELECT GREATEST(0,
            COALESCE(SUM(CASE WHEN type = 'topup' THEN amount_cents ELSE 0 END), 0)
          + COALESCE(SUM(CASE WHEN type = 'refund' THEN amount_cents ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN type = 'charge' THEN amount_cents ELSE 0 END), 0)
        )::int AS balance_cents
         FROM app_receipts
        WHERE user_id = $1
          AND (currency IS NULL OR UPPER(currency) = 'USD')`,
        [params.userId]
      );
      const balanceCents = Number(walletRows[0]?.balance_cents ?? 0);
      if (balanceCents < estimate.amountCents) {
        throw new Error('INSUFFICIENT_WALLET_BALANCE');
      }

      await executor.query(
        `INSERT INTO app_receipts (
            user_id, type, amount_cents, currency, description, job_id, surface,
            billing_product_key, pricing_snapshot, metadata
          )
          VALUES ($1,'charge',$2,'USD',$3,$4,'timeline_export','server_render',$5::jsonb,$6::jsonb)
          ON CONFLICT DO NOTHING`,
        [
          params.userId,
          estimate.amountCents,
          `Server export ${params.projectName} - ${Math.ceil(params.durationSec)}s`,
          exportId,
          JSON.stringify(params.pricingSnapshot),
          JSON.stringify({ product: 'maxvideoai-editor-server-export' }),
        ]
      );
    }

    const rows = await executor.query<TimelineExportJobRecord>(
      `INSERT INTO app_timeline_exports (
          id, user_id, idempotency_key, project_name, duration_sec, resolution, fps,
          quality_preset, amount_cents, currency, billing_kind, billing_status,
          render_manifest, export_settings
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb)
        RETURNING *`,
      [
        exportId,
        params.userId,
        params.idempotencyKey,
        params.projectName,
        params.durationSec,
        params.resolution,
        params.fps,
        params.qualityPreset,
        billing.amountCents,
        billing.currency,
        billing.billingKind,
        billing.billingStatus,
        JSON.stringify(params.renderManifest),
        JSON.stringify(params.exportSettings),
      ]
    );
    return { job: rows[0], billing, reused: false };
  });
}

export async function releaseFailedTimelineExportBilling(params: {
  userId: string;
  exportId: string;
  billingStatus: TimelineExportBillingStatus;
  amountCents: number;
}): Promise<TimelineExportBillingStatus> {
  if (params.billingStatus === 'free_reserved') return 'free_released';
  if (params.billingStatus !== 'paid_reserved' || params.amountCents <= 0) return params.billingStatus;
  await query(
    `INSERT INTO app_receipts (
        user_id, type, amount_cents, currency, description, job_id, surface,
        billing_product_key, metadata
      )
      VALUES ($1,'refund',$2,'USD','Refund failed server export',$3,'timeline_export','server_render',$4::jsonb)
      ON CONFLICT DO NOTHING`,
    [params.userId, params.amountCents, params.exportId, JSON.stringify({ reason: 'timeline_export_failed' })]
  );
  return 'refunded';
}
